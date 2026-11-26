export type TunnelStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'disconnecting'
  | 'error';

export type ComplianceMode = 'private' | 'cert_in_audit';

export interface User {
  id: number;
  email: string;
  full_name: string;
  is_admin: boolean;
  is_active: boolean;
  created_at: string;
}

export interface AuthTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export interface ServerNode {
  id: number;
  slug: string;
  name: string;
  city: string;
  region_code: string;
  provider: string;
  endpoint_host: string;
  listen_port: number;
  public_key: string;
  subnet_cidr: string;
  dns_servers: string;
  mtu: number;
  max_peers: number;
  active_peers: number;
  load_percent: number;
  latency_ms_estimate: number;
  is_active: boolean;
}

export interface PeerRecord {
  id: number;
  user_id: number;
  server_id: number;
  server_slug: string;
  server_name: string;
  server_city: string;
  device_name: string;
  public_key: string;
  assigned_ip: string;
  endpoint: string;
  is_active: boolean;
  created_at: string;
  revoked_at: string | null;
  has_server_private_key: boolean;
}

export interface PeerProvisionResponse {
  peer: PeerRecord;
  client_private_key: string | null;
  preshared_key: string;
  wg_quick_config: string;
}

export interface WireGuardKeyPair {
  privateKey: string;
  publicKey: string;
}

export interface WireGuardStatusEvent {
  status: TunnelStatus;
  error?: string;
}

export interface WireGuardNativeBridge {
  connect(configText: string, tunnelName: string): Promise<void>;
  disconnect(): Promise<void>;
  getStatus(): Promise<TunnelStatus>;
  generateKeyPair(): Promise<WireGuardKeyPair>;
}
