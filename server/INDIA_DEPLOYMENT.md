# India WireGuard VPN Deployment Guide

This guide covers deploying the WireGuard exit nodes and FastAPI control plane across major Indian cloud regions, tuning for Indian mobile/broadband networks, and configuring the backend for CERT-In (2022) compliance vs. private self-hosted operation.

---

## 1. Recommended Indian Cloud Regions

| Provider | Region / Code | City | Typical Latency (Domestic) | Notes |
| --- | --- | --- | --- | --- |
| **AWS** | `ap-south-1` | Mumbai | 5–25 ms (West/South), 25–40 ms (North) | Best international peering (MENA, Singapore, Europe via submarine cables); `t4g.micro` (ARM64 Graviton) is very cost-effective for WireGuard. |
| **AWS** | `ap-south-2` | Hyderabad | 10–30 ms (South/Central) | Strong secondary region for failover/multi-AZ routing. |
| **DigitalOcean** | `blr1` | Bangalore | 5–20 ms (South), 25–45 ms (North/West) | Simple flat-rate bandwidth pricing; 1 TB+ transfer included on basic Droplets. |
| **Vultr** | `bom` / `del` | Mumbai / Delhi NCR | 5–25 ms | Delhi NCR (`del`) significantly lowers RTT for North India users (NCR, Chandigarh, Lucknow, Jaipur). |
| **Linode (Akamai)** | `in-maa` / `ap-west` | Chennai / Mumbai | 5–25 ms | Chennai (`in-maa`) has low latency to Tamil Nadu, Andhra Pradesh, and Singapore (`ap-south`). |
| **Oracle Cloud (Free Tier)** | `ap-mumbai-1` / `ap-hyderabad-1` | Mumbai / Hyderabad | 10–30 ms | **\$0/month Always Free** ARM64 Ampere (`VM.Standard.A1.Flex`, up to 4 OCPU / 24 GB RAM, 10 TB/month outbound transfer) — ideal for zero-cost open-source self-hosting. |
| **AWS Free Tier** | `ap-south-1` / `ap-south-2` | Mumbai / Hyderabad | 5–30 ms | 12 months free tier on eligible `t2.micro` / `t3.micro` instances (check outbound bandwidth quota). |

> **Tip:** Deploy at least **one West/North node** (Mumbai or Delhi NCR) and **one South node** (Bangalore, Hyderabad, or Chennai) and register both in the FastAPI backend so mobile clients can pick the lowest-latency gateway.

---

## 2. Cloud Firewall & Security Group Rules

Open **only** the required ports on your cloud firewall / AWS Security Group:

| Protocol | Port | Source | Purpose |
| --- | --- | --- | --- |
| UDP | `51820` | `0.0.0.0/0` (and `::/0` if dual-stack) | WireGuard tunnel traffic |
| TCP | `443` | `0.0.0.0/0` | HTTPS FastAPI control plane (via Caddy) |
| TCP | `80` | `0.0.0.0/0` | ACME HTTP-01 challenge for TLS cert issuance |
| TCP | `22` | Your admin IP CIDR only | SSH administration |

---

## 3. Bare-Metal / VM Ubuntu 22.04 / 24.04 Setup

1. Clone the repository onto the Indian VPS:
   ```bash
   git clone <your-repo-url> /opt/india-vpn
   cd /opt/india-vpn/server
   ```
2. Provision WireGuard, kernel forwarding, BBR congestion control, and NAT rules:
   ```bash
   sudo WG_PORT=51820 WG_MTU=1420 ./scripts/setup-wireguard.sh
   ```
3. Verify the interface and NAT forwarding:
   ```bash
   sudo ./scripts/healthcheck.sh wg0
   sudo wg show wg0
   ```
4. For `nftables`-only hosts (Debian 12+ minimal), inspect and load [nftables.conf](firewall/nftables.conf) after updating `WAN_IF` to your primary NIC (e.g., `ens5` on AWS EC2 or `eth0` on DigitalOcean).

### Indian Network MTU Tuning

Indian telecom operators (Jio 4G/5G, Airtel, Vi) and domestic FTTH ISPs using PPPoE (e.g., Airtel Xstream, BSNL, ACT) frequently use smaller upstream MTUs (1492 or ~1420 bytes).
- Our `wg0.conf.template` and `iptables-rules.sh` enable **TCP MSS clamping** (`--clamp-mss-to-pmtu`) and default to `MTU = 1420`.
- If clients on specific mobile LTE/5G networks experience stalled TLS handshakes, lower client `MTU` to `1360` or `1280` in `WG_DEFAULT_MTU` on the backend.

### Gaming / BGMI Latency Expectations Outside India

> **Important physics constraint:** A VPN cannot make network packets travel faster than fiber-optic speed-of-light (~200,000 km/s). Total in-game ping equals *(Your country → India VPN server RTT)* + *(India VPN server → BGMI Mumbai server RTT)*:
> - **UAE / Oman / GCC → Mumbai:** ~30–45 ms (within 20–45 ms target)
> - **Singapore / Malaysia → Chennai or Mumbai:** ~45–65 ms
> - **Europe (UK/DE) → Mumbai:** ~110–145 ms (physical minimum prevents 20–40 ms)
> - **North America → Mumbai:** ~180–230 ms (physical minimum prevents 20–40 ms)

To minimize jitter and packet loss from abroad:
1. Host the node in **Mumbai** (closest to BGMI's Indian game servers) and keep `setup-wireguard.sh` UDP buffer tuning enabled.
2. Enable **Gaming Mode** (`MTU = 1360`, `PersistentKeepalive = 15`) and **BGMI-Only Split Tunnel** (`IncludedApplications = com.pubg.imobile` on Android) in the mobile app so background downloads do not cause ping spikes.
3. Prefer a non-blocklisted Indian residential/fiber IP or smaller Indian VPS ASN if BGMI flags major cloud provider ASNs.

---

## 4. Docker Compose Deployment (Control Plane + WireGuard)

1. Copy `.env.example` to `.env` and populate strong secrets:
   ```bash
   cd /opt/india-vpn/server
   cp .env.example .env
   openssl rand -hex 32  # paste into JWT_SECRET_KEY
   ```
2. Start the stack:
   ```bash
   docker compose up -d --build
   ```
3. Verify health:
   ```bash
   curl -s https://api.vpn-bom.example.com/health
   ```

---

## 5. CERT-In (2022) Compliance vs. Self-Hosted Private Mode

Under the **CERT-In Directions dated 28 April 2022** (under Section 70B(6) of the IT Act, 2000), commercial VPN service providers operating infrastructure or serving subscribers in India are required to retain subscriber registration details, allocated IP addresses, connection timestamps, and usage patterns for **5 years** (180 days for general ICT logs, 5 years for VPN subscriber/IP records). By contrast, **private self-hosted / enterprise internal VPNs** used solely by an individual or private organization for internal access do not operate as public commercial VPN providers.

The FastAPI backend models this explicitly via `COMPLIANCE_MODE`:

- **`COMPLIANCE_MODE=private`** (default):
  - Zero connection-history logging: `POST /api/v1/peers/{id}/telemetry` does **not** persist source IP or session timestamp rows.
  - Suitable for personal/private self-hosted WireGuard deployments.
- **`COMPLIANCE_MODE=cert_in_audit`**:
  - Persists structured `ConnectionAuditLog` entries (`user_id`, `peer_id`, `server_id`, `assigned_vpn_ip`, `source_ip`, `connected_at`, `disconnected_at`, `retention_until` = +5 years / 1825 days) whenever peers connect/disconnect or are provisioned.
  - Exposes `GET /api/v1/admin/audit-logs` for admin export/compliance reporting.
  - Ensure NTP synchronization (`chronyd` or `systemd-timesyncd` pointed to `in.pool.ntp.org` / NPL India) is active on the host, as CERT-In also mandates synchronized IST (`Asia/Kolkata`) timestamps.
