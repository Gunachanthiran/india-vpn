import {ApiError, VpnApiClient} from '../services/api';

describe('VpnApiClient', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.resetAllMocks();
  });

  it('logs in and attaches bearer token to subsequent server requests', async () => {
    const mockFetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          access_token: 'jwt-access-123',
          refresh_token: 'jwt-refresh-456',
          token_type: 'bearer',
          expires_in: 3600,
          user: {
            id: 1,
            email: 'ananya@example.in',
            full_name: 'Ananya Rao',
            is_admin: false,
            is_active: true,
            created_at: '2026-01-01T00:00:00Z',
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [
          {
            id: 1,
            slug: 'in-bom-aws',
            name: 'Mumbai 01 (AWS ap-south-1)',
            city: 'Mumbai',
            region_code: 'ap-south-1',
            provider: 'AWS',
            endpoint_host: 'bom1.indiavpn.example.com',
            listen_port: 51820,
            public_key: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
            subnet_cidr: '10.8.0.0/24',
            dns_servers: '1.1.1.1,9.9.9.9',
            mtu: 1420,
            max_peers: 250,
            active_peers: 4,
            load_percent: 2,
            latency_ms_estimate: 14,
            is_active: true,
          },
        ],
      });

    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const client = new VpnApiClient('https://api.indiavpn.example.com');
    const auth = await client.login('ananya@example.in', 'Password123!');
    expect(auth.user.email).toBe('ananya@example.in');

    const servers = await client.listServers();
    expect(servers).toHaveLength(1);
    expect(servers[0].city).toBe('Mumbai');

    const secondCallInit = mockFetch.mock.calls[1][1] as RequestInit;
    expect(
      (secondCallInit.headers as Record<string, string>).Authorization,
    ).toBe('Bearer jwt-access-123');
  });

  it('throws ApiError with backend detail message on HTTP failure', async () => {
    globalThis.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({detail: 'Invalid email or password'}),
    }) as unknown as typeof fetch;

    const client = new VpnApiClient('https://api.indiavpn.example.com');
    await expect(client.login('bad@example.in', 'wrong')).rejects.toEqual(
      new ApiError(401, 'Invalid email or password'),
    );
  });

  it('sends gamingMode and splitTunnelApps when provisioning peer', async () => {
    const mockFetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({
        peer: {
          id: 1,
          user_id: 1,
          server_id: 1,
          server_slug: 'in-bom-aws',
          server_name: 'Mumbai 01',
          server_city: 'Mumbai',
          device_name: 'IndiaVPN-android',
          public_key: 'PUB',
          assigned_ip: '10.8.0.2',
          endpoint: '203.0.113.45:51820',
          is_active: true,
          created_at: '2026-01-01T00:00:00Z',
          revoked_at: null,
          has_server_private_key: false,
        },
        client_private_key: null,
        preshared_key: 'PSK',
        wg_quick_config: '[Interface]\nMTU = 1360\n',
      }),
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const client = new VpnApiClient('https://api.indiavpn.example.com');
    await client.provisionPeer(1, 'IndiaVPN-android', 'CLIENT_PUB', {
      gamingMode: true,
      splitTunnelApps: 'com.pubg.imobile',
    });

    const sentBody = JSON.parse(
      (mockFetch.mock.calls[0][1] as RequestInit).body as string,
    );
    expect(sentBody.gaming_mode).toBe(true);
    expect(sentBody.split_tunnel_apps).toBe('com.pubg.imobile');
  });
});
