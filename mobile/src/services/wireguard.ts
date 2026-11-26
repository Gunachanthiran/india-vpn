import {NativeEventEmitter, NativeModules, Platform} from 'react-native';
import {
  TunnelStatus,
  WireGuardKeyPair,
  WireGuardNativeBridge,
  WireGuardStatusEvent,
} from '../types/vpn';

const STATUS_EVENT = 'WireGuardStatusChanged';

/**
 * TypeScript facade over the native WireGuard bridge:
 * - Android: WireGuardModule.kt -> VpnService + GoBackend (com.wireguard.android:tunnel)
 * - iOS: WireGuardBridge.swift -> NETunnelProviderManager + NEPacketTunnelProvider (WireGuardKit)
 *
 * When running inside Jest or a non-native preview without the linked module,
 * falls back cleanly to an in-memory simulated tunnel controller.
 */
export class WireGuardTunnelService {
  private readonly nativeBridge: WireGuardNativeBridge | undefined;
  private readonly emitter: NativeEventEmitter | null;
  private simulatedStatus: TunnelStatus = 'disconnected';
  private simulatedListeners = new Set<(event: WireGuardStatusEvent) => void>();

  constructor(bridgeOverride?: WireGuardNativeBridge) {
    const linked =
      bridgeOverride ??
      (NativeModules.WireGuardTunnel as WireGuardNativeBridge | undefined);
    this.nativeBridge = linked;
    this.emitter = NativeModules.WireGuardTunnel
      ? new NativeEventEmitter(NativeModules.WireGuardTunnel)
      : null;
  }

  isNativeAvailable(): boolean {
    return Boolean(this.nativeBridge);
  }

  getPlatformBackendLabel(): string {
    if (!this.nativeBridge) {
      return 'Simulator Mode (No Native Extension)';
    }
    return Platform.OS === 'ios'
      ? 'iOS NEPacketTunnelProvider (WireGuardKit)'
      : 'Android VpnService (GoBackend)';
  }

  async generateKeyPair(): Promise<WireGuardKeyPair | null> {
    if (this.nativeBridge?.generateKeyPair) {
      return this.nativeBridge.generateKeyPair();
    }
    return null;
  }

  async connect(configText: string, tunnelName = 'india-wg0'): Promise<void> {
    if (!configText.includes('[Interface]') || !configText.includes('[Peer]')) {
      throw new Error('Invalid WireGuard configuration payload');
    }
    if (configText.includes('<INSERT_CLIENT_PRIVATE_KEY>')) {
      throw new Error('Client private key has not been injected into config');
    }

    if (this.nativeBridge) {
      await this.nativeBridge.connect(configText, tunnelName);
      return;
    }

    this.emitSimulated({status: 'connecting'});
    this.emitSimulated({status: 'connected'});
  }

  async disconnect(): Promise<void> {
    if (this.nativeBridge) {
      await this.nativeBridge.disconnect();
      return;
    }

    this.emitSimulated({status: 'disconnecting'});
    this.emitSimulated({status: 'disconnected'});
  }

  async getStatus(): Promise<TunnelStatus> {
    if (this.nativeBridge) {
      return this.nativeBridge.getStatus();
    }
    return this.simulatedStatus;
  }

  subscribeStatus(listener: (event: WireGuardStatusEvent) => void): () => void {
    if (this.emitter) {
      const sub = this.emitter.addListener(STATUS_EVENT, listener);
      return () => sub.remove();
    }
    this.simulatedListeners.add(listener);
    return () => {
      this.simulatedListeners.delete(listener);
    };
  }

  private emitSimulated(event: WireGuardStatusEvent): void {
    this.simulatedStatus = event.status;
    this.simulatedListeners.forEach(cb => cb(event));
  }
}

export function injectClientPrivateKey(
  wgQuickConfig: string,
  privateKey: string,
): string {
  return wgQuickConfig.replace('<INSERT_CLIENT_PRIVATE_KEY>', privateKey);
}

export interface WgConfigSummary {
  address: string;
  endpoint: string;
}

export function parseWgQuickSummary(wgQuickConfig: string): WgConfigSummary {
  const addressMatch = wgQuickConfig.match(/^\s*Address\s*=\s*(.+)$/im);
  const endpointMatch = wgQuickConfig.match(/^\s*Endpoint\s*=\s*(.+)$/im);
  return {
    address: addressMatch ? addressMatch[1].trim() : '10.8.0.2/32',
    endpoint: endpointMatch ? endpointMatch[1].trim() : 'Custom WireGuard Node',
  };
}

export function applyGamingTweaks(
  wgQuickConfig: string,
  options: {gamingMode: boolean; splitTunnelApp?: string | null},
): string {
  let lines = wgQuickConfig
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter(line => !/^\s*IncludedApplications\s*=/i.test(line));

  const setOrInsertInSection = (
    sectionHeader: string,
    key: string,
    value: string,
  ) => {
    const keyRegex = new RegExp(`^\\s*${key}\\s*=`, 'i');
    const existingIdx = lines.findIndex(l => keyRegex.test(l));
    if (existingIdx !== -1) {
      lines[existingIdx] = `${key} = ${value}`;
      return;
    }
    const secIdx = lines.findIndex(
      l => l.trim().toLowerCase() === sectionHeader.toLowerCase(),
    );
    if (secIdx !== -1) {
      lines.splice(secIdx + 1, 0, `${key} = ${value}`);
    }
  };

  if (options.gamingMode) {
    setOrInsertInSection('[Interface]', 'MTU', '1360');
    setOrInsertInSection('[Interface]', 'DNS', '1.1.1.1,8.8.8.8');
    setOrInsertInSection('[Peer]', 'PersistentKeepalive', '15');
  }

  if (options.splitTunnelApp) {
    setOrInsertInSection(
      '[Interface]',
      'IncludedApplications',
      options.splitTunnelApp,
    );
  }

  return `${lines.join('\n').trim()}\n`;
}
