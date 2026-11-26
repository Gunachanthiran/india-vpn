import {
  applyGamingTweaks,
  injectClientPrivateKey,
  parseWgQuickSummary,
  WireGuardTunnelService,
} from '../services/wireguard';
import {WireGuardNativeBridge} from '../types/vpn';

const SAMPLE_CONFIG = `[Interface]
PrivateKey = <INSERT_CLIENT_PRIVATE_KEY>
Address = 10.8.0.2/32
DNS = 1.1.1.1,9.9.9.9
MTU = 1420

[Peer]
PublicKey = BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=
PresharedKey = CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC=
AllowedIPs = 0.0.0.0/0, ::/0
Endpoint = bom1.indiavpn.example.com:51820
PersistentKeepalive = 25
`;

describe('WireGuardTunnelService', () => {
  it('injects client private key and rejects unresolved placeholder', async () => {
    const svc = new WireGuardTunnelService();
    await expect(svc.connect(SAMPLE_CONFIG)).rejects.toThrow(
      'Client private key has not been injected',
    );

    const resolved = injectClientPrivateKey(
      SAMPLE_CONFIG,
      'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
    );
    const events: string[] = [];
    const unsubscribe = svc.subscribeStatus(evt => events.push(evt.status));
    await svc.connect(resolved);
    expect(await svc.getStatus()).toBe('connected');
    expect(events).toEqual(['connecting', 'connected']);

    await svc.disconnect();
    expect(await svc.getStatus()).toBe('disconnected');
    unsubscribe();
  });

  it('delegates to native bridge when present', async () => {
    const mockBridge: WireGuardNativeBridge = {
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
      getStatus: jest.fn().mockResolvedValue('connected'),
      generateKeyPair: jest.fn().mockResolvedValue({
        privateKey: 'priv',
        publicKey: 'pub',
      }),
    };

    const svc = new WireGuardTunnelService(mockBridge);
    expect(svc.isNativeAvailable()).toBe(true);

    const kp = await svc.generateKeyPair();
    expect(kp).toEqual({privateKey: 'priv', publicKey: 'pub'});

    const resolved = injectClientPrivateKey(SAMPLE_CONFIG, 'priv');
    await svc.connect(resolved, 'india-in-bom-aws');
    expect(mockBridge.connect).toHaveBeenCalledWith(
      resolved,
      'india-in-bom-aws',
    );
    expect(await svc.getStatus()).toBe('connected');
    await svc.disconnect();
    expect(mockBridge.disconnect).toHaveBeenCalled();
  });

  it('parses endpoint/address and applies BGMI gaming tweaks to pasted config', () => {
    const summary = parseWgQuickSummary(SAMPLE_CONFIG);
    expect(summary).toEqual({
      address: '10.8.0.2/32',
      endpoint: 'bom1.indiavpn.example.com:51820',
    });

    const tweaked = applyGamingTweaks(SAMPLE_CONFIG, {
      gamingMode: true,
      splitTunnelApp: 'com.pubg.imobile',
    });
    expect(tweaked).toContain('MTU = 1360');
    expect(tweaked).toContain('DNS = 1.1.1.1,8.8.8.8');
    expect(tweaked).toContain('PersistentKeepalive = 15');
    expect(tweaked).toContain('IncludedApplications = com.pubg.imobile');
  });

  it('persists and clears stored direct config across service calls', async () => {
    const svc = new WireGuardTunnelService();
    expect(await svc.loadStoredConfig()).toBeNull();
    await svc.saveStoredConfig(SAMPLE_CONFIG, 'Mumbai BGMI');
    expect(await svc.loadStoredConfig()).toEqual({
      configText: SAMPLE_CONFIG,
      label: 'Mumbai BGMI',
    });
    await svc.clearStoredConfig();
    expect(await svc.loadStoredConfig()).toBeNull();
  });
});
