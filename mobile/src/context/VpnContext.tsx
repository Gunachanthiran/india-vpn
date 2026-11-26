import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {Platform} from 'react-native';
import {VpnApiClient} from '../services/api';
import {
  injectClientPrivateKey,
  WireGuardTunnelService,
} from '../services/wireguard';
import {
  ComplianceMode,
  PeerProvisionResponse,
  ServerNode,
  TunnelStatus,
  User,
} from '../types/vpn';

interface VpnContextValue {
  apiBaseUrl: string;
  setApiBaseUrl: (url: string) => void;
  user: User | null;
  servers: ServerNode[];
  selectedServer: ServerNode | null;
  activeProvision: PeerProvisionResponse | null;
  tunnelStatus: TunnelStatus;
  connectedSeconds: number;
  measuredRttMs: number | null;
  gamingMode: boolean;
  setGamingMode: (enabled: boolean) => void;
  bgmiSplitTunnel: boolean;
  setBgmiSplitTunnel: (enabled: boolean) => void;
  complianceMode: ComplianceMode;
  nativeBackendLabel: string;
  loading: boolean;
  error: string | null;
  clearError: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshServers: () => Promise<void>;
  selectServer: (server: ServerNode) => void;
  toggleConnection: () => Promise<void>;
  rotateDeviceKeyAndReprovision: () => Promise<void>;
}

const VpnContext = createContext<VpnContextValue | undefined>(undefined);

const DEFAULT_API_URL =
  Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://127.0.0.1:8000';

export const VpnProvider: React.FC<{children: React.ReactNode}> = ({
  children,
}) => {
  const [apiBaseUrl, setApiBaseUrl] = useState(DEFAULT_API_URL);
  const [user, setUser] = useState<User | null>(null);
  const [servers, setServers] = useState<ServerNode[]>([]);
  const [selectedServer, setSelectedServer] = useState<ServerNode | null>(null);
  const [activeProvision, setActiveProvision] =
    useState<PeerProvisionResponse | null>(null);
  const [tunnelStatus, setTunnelStatus] =
    useState<TunnelStatus>('disconnected');
  const [connectedSeconds, setConnectedSeconds] = useState(0);
  const [measuredRttMs, setMeasuredRttMs] = useState<number | null>(null);
  const [gamingMode, setGamingMode] = useState(true);
  const [bgmiSplitTunnel, setBgmiSplitTunnel] = useState(
    Platform.OS === 'android',
  );
  const [complianceMode, setComplianceMode] =
    useState<ComplianceMode>('private');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiRef = useRef<VpnApiClient>(new VpnApiClient(DEFAULT_API_URL));
  const wgRef = useRef<WireGuardTunnelService>(new WireGuardTunnelService());

  const handleSetApiBaseUrl = useCallback((url: string) => {
    const normalized = url.trim().replace(/\/+$/, '');
    setApiBaseUrl(normalized);
    apiRef.current = new VpnApiClient(normalized);
  }, []);

  useEffect(() => {
    const unsubscribe = wgRef.current.subscribeStatus(evt => {
      setTunnelStatus(evt.status);
      if (evt.error) {
        setError(evt.error);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (tunnelStatus !== 'connected') {
      setConnectedSeconds(0);
      return;
    }
    const timer = setInterval(() => {
      setConnectedSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [tunnelStatus]);

  const loadWorkspace = useCallback(async () => {
    const [healthInfo, serverList, rttMs] = await Promise.all([
      apiRef.current.health(),
      apiRef.current.listServers(),
      apiRef.current.measureControlPlaneRttMs().catch(() => null),
    ]);
    setComplianceMode(healthInfo.compliance_mode);
    setMeasuredRttMs(rttMs);
    setServers(serverList);
    setSelectedServer(prev => {
      if (prev && serverList.some(s => s.id === prev.id)) {
        return prev;
      }
      return serverList[0] ?? null;
    });
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      setLoading(true);
      setError(null);
      try {
        const auth = await apiRef.current.login(email, password);
        setUser(auth.user);
        await loadWorkspace();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Sign-in failed');
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [loadWorkspace],
  );

  const signUp = useCallback(
    async (email: string, password: string, fullName: string) => {
      setLoading(true);
      setError(null);
      try {
        const auth = await apiRef.current.register(email, password, fullName);
        setUser(auth.user);
        await loadWorkspace();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Registration failed');
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [loadWorkspace],
  );

  const signOut = useCallback(async () => {
    if (tunnelStatus === 'connected' || tunnelStatus === 'connecting') {
      await wgRef.current.disconnect();
    }
    apiRef.current.setAccessToken(null);
    setUser(null);
    setServers([]);
    setSelectedServer(null);
    setActiveProvision(null);
    setTunnelStatus('disconnected');
  }, [tunnelStatus]);

  const refreshServers = useCallback(async () => {
    setLoading(true);
    try {
      await loadWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load servers');
    } finally {
      setLoading(false);
    }
  }, [loadWorkspace]);

  const provisionForServer = useCallback(
    async (server: ServerNode): Promise<PeerProvisionResponse> => {
      const localKeyPair = await wgRef.current.generateKeyPair();
      const deviceLabel = `IndiaVPN-${Platform.OS}`;
      const splitApps =
        Platform.OS === 'android' && bgmiSplitTunnel
          ? 'com.pubg.imobile'
          : undefined;
      const provisioned = await apiRef.current.provisionPeer(
        server.id,
        deviceLabel,
        localKeyPair?.publicKey,
        {gamingMode, splitTunnelApps: splitApps},
      );

      const finalConfig = localKeyPair
        ? injectClientPrivateKey(
            provisioned.wg_quick_config,
            localKeyPair.privateKey,
          )
        : provisioned.wg_quick_config;

      const resolved: PeerProvisionResponse = {
        ...provisioned,
        wg_quick_config: finalConfig,
      };
      setActiveProvision(resolved);
      return resolved;
    },
    [bgmiSplitTunnel, gamingMode],
  );

  const selectServer = useCallback((server: ServerNode) => {
    setSelectedServer(server);
  }, []);

  const toggleConnection = useCallback(async () => {
    setError(null);
    if (tunnelStatus === 'connected' || tunnelStatus === 'connecting') {
      setTunnelStatus('disconnecting');
      try {
        await wgRef.current.disconnect();
        if (activeProvision) {
          await apiRef.current
            .recordTelemetry(activeProvision.peer.id, 'disconnect')
            .catch(() => undefined);
        }
        setTunnelStatus('disconnected');
      } catch (err) {
        setTunnelStatus('error');
        setError(err instanceof Error ? err.message : 'Disconnect failed');
      }
      return;
    }

    if (!selectedServer) {
      setError('Select an India server node first.');
      return;
    }

    setLoading(true);
    setTunnelStatus('connecting');
    try {
      let provision = activeProvision;
      if (!provision || provision.peer.server_id !== selectedServer.id) {
        provision = await provisionForServer(selectedServer);
      }
      await wgRef.current.connect(
        provision.wg_quick_config,
        `india-${selectedServer.slug}`,
      );
      await apiRef.current
        .recordTelemetry(provision.peer.id, 'connect', selectedServer.slug)
        .catch(() => undefined);
      setTunnelStatus('connected');
    } catch (err) {
      setTunnelStatus('error');
      setError(err instanceof Error ? err.message : 'Tunnel connection failed');
    } finally {
      setLoading(false);
    }
  }, [activeProvision, provisionForServer, selectedServer, tunnelStatus]);

  const rotateDeviceKeyAndReprovision = useCallback(async () => {
    if (!selectedServer) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (tunnelStatus === 'connected') {
        await wgRef.current.disconnect();
      }
      if (activeProvision) {
        await apiRef.current.revokePeer(activeProvision.peer.id);
      }
      await provisionForServer(selectedServer);
      setTunnelStatus('disconnected');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rotate keys');
    } finally {
      setLoading(false);
    }
  }, [activeProvision, provisionForServer, selectedServer, tunnelStatus]);

  const value = useMemo<VpnContextValue>(
    () => ({
      apiBaseUrl,
      setApiBaseUrl: handleSetApiBaseUrl,
      user,
      servers,
      selectedServer,
      activeProvision,
      tunnelStatus,
      connectedSeconds,
      measuredRttMs,
      gamingMode,
      setGamingMode: (enabled: boolean) => {
        setGamingMode(enabled);
        setActiveProvision(null);
      },
      bgmiSplitTunnel,
      setBgmiSplitTunnel: (enabled: boolean) => {
        setBgmiSplitTunnel(enabled);
        setActiveProvision(null);
      },
      complianceMode,
      nativeBackendLabel: wgRef.current.getPlatformBackendLabel(),
      loading,
      error,
      clearError: () => setError(null),
      signIn,
      signUp,
      signOut,
      refreshServers,
      selectServer,
      toggleConnection,
      rotateDeviceKeyAndReprovision,
    }),
    [
      apiBaseUrl,
      handleSetApiBaseUrl,
      user,
      servers,
      selectedServer,
      activeProvision,
      tunnelStatus,
      connectedSeconds,
      measuredRttMs,
      gamingMode,
      bgmiSplitTunnel,
      complianceMode,
      loading,
      error,
      signIn,
      signUp,
      signOut,
      refreshServers,
      selectServer,
      toggleConnection,
      rotateDeviceKeyAndReprovision,
    ],
  );

  return <VpnContext.Provider value={value}>{children}</VpnContext.Provider>;
};

export function useVpn(): VpnContextValue {
  const ctx = useContext(VpnContext);
  if (!ctx) {
    throw new Error('useVpn must be used inside a VpnProvider');
  }
  return ctx;
}
