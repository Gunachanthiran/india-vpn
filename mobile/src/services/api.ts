import {
  AuthTokenResponse,
  ComplianceMode,
  PeerProvisionResponse,
  PeerRecord,
  ServerNode,
  User,
} from '../types/vpn';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class VpnApiClient {
  private accessToken: string | null = null;

  constructor(private readonly baseUrl: string = 'http://10.0.2.2:8000') {}

  setAccessToken(token: string | null): void {
    this.accessToken = token;
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(init.headers as Record<string, string> | undefined),
    };

    if (this.accessToken) {
      headers.Authorization = `Bearer ${this.accessToken}`;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers,
    });

    if (!response.ok) {
      let detail = `HTTP ${response.status}`;
      try {
        const body = (await response.json()) as {detail?: string};
        if (body.detail) {
          detail = body.detail;
        }
      } catch {
        // Ignore JSON parse failures on error responses
      }
      throw new ApiError(response.status, detail);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }

  async health(): Promise<{status: string; compliance_mode: ComplianceMode}> {
    return this.request('/health');
  }

  async register(
    email: string,
    password: string,
    fullName: string,
  ): Promise<AuthTokenResponse> {
    const data = await this.request<AuthTokenResponse>('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({email, password, full_name: fullName}),
    });
    this.accessToken = data.access_token;
    return data;
  }

  async login(email: string, password: string): Promise<AuthTokenResponse> {
    const data = await this.request<AuthTokenResponse>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({email, password}),
    });
    this.accessToken = data.access_token;
    return data;
  }

  async me(): Promise<User> {
    return this.request<User>('/api/v1/auth/me');
  }

  async listServers(): Promise<ServerNode[]> {
    return this.request<ServerNode[]>('/api/v1/servers');
  }

  async measureControlPlaneRttMs(): Promise<number> {
    const start = Date.now();
    await this.request<{ok: boolean}>('/api/v1/servers/ping');
    return Math.max(1, Date.now() - start);
  }

  async listPeers(): Promise<PeerRecord[]> {
    return this.request<PeerRecord[]>('/api/v1/peers');
  }

  async provisionPeer(
    serverId: number,
    deviceName: string,
    clientPublicKey?: string,
    options?: {gamingMode?: boolean; splitTunnelApps?: string},
  ): Promise<PeerProvisionResponse> {
    return this.request<PeerProvisionResponse>('/api/v1/peers', {
      method: 'POST',
      body: JSON.stringify({
        server_id: serverId,
        device_name: deviceName,
        client_public_key: clientPublicKey ?? null,
        gaming_mode: options?.gamingMode ?? false,
        split_tunnel_apps: options?.splitTunnelApps ?? null,
      }),
    });
  }

  async revokePeer(peerId: number): Promise<void> {
    await this.request<void>(`/api/v1/peers/${peerId}`, {method: 'DELETE'});
  }

  async recordTelemetry(
    peerId: number,
    eventType: 'connect' | 'disconnect',
    note?: string,
  ): Promise<{recorded: boolean; compliance_mode: ComplianceMode}> {
    return this.request(`/api/v1/peers/${peerId}/telemetry`, {
      method: 'POST',
      body: JSON.stringify({event_type: eventType, note}),
    });
  }
}
