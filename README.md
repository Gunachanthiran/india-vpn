# India WireGuard VPN — Full-Stack Open-Source Platform

**License:** [MIT](LICENSE) — 100% free and open source.

A full-stack WireGuard VPN engineered for Indian deployments (Mumbai, Hyderabad, Bangalore, Delhi NCR, Chennai), comprising:

- **`server/`** — Ubuntu/Debian WireGuard host provisioning scripts, `wg0.conf` templates, `iptables`/`nftables` NAT & firewall rules, Docker Compose stack, and an India cloud deployment & CERT-In compliance guide (including **\$0 Always Free** Oracle Cloud Mumbai/Hyderabad options).
- **`backend/`** — Python 3.12 + FastAPI control plane for user authentication (JWT), X25519 WireGuard key/peer provisioning, `/32` IP pool allocation & recycling, `.conf` & QR code export, configurable CERT-In (2022) vs. private zero-log compliance modes, and `pytest` suite.
- **`mobile/`** — React Native (TypeScript) mobile client for Android and iOS with native WireGuard tunnel modules (`VpnService` + `com.wireguard.android:tunnel` on Android, `NEPacketTunnelProvider` + `WireGuardKit` on iOS), India server selector, connection controls, and config inspection.
- **`.github/workflows/ci.yml`** — Free GitHub Actions CI for public repositories that runs backend tests, mobile TypeScript/Jest tests, and automatically compiles a standalone, shareable **`IndiaVPN-android-release.apk`** (no Metro or source code required to install on Android).

## Zero-Cost Open-Source Distribution Flow

1. **Backend & WireGuard Server (\$0):**
   Deploy [server/docker-compose.yml](server/docker-compose.yml) on an **Oracle Cloud Always Free** Ubuntu VM in Mumbai (`ap-mumbai-1`) or Hyderabad (`ap-hyderabad-1`), or any Ubuntu/Debian VPS. See [server/INDIA_DEPLOYMENT.md](server/INDIA_DEPLOYMENT.md).
2. **Android Standalone App (\$0):**
   Push this repository to a **public GitHub repository**. GitHub Actions ([.github/workflows/ci.yml](.github/workflows/ci.yml)) automatically builds `IndiaVPN-android-release.apk` on `ubuntu-latest` for free. Download the `.apk` from **Actions → Artifacts** (or **Releases** when you push a `v1.0.0` tag) and share just the `.apk` file with anyone—no source code or laptop needed.
   *(Or build locally with Android Studio + JDK 17 via `cd mobile/android && gradle assembleRelease`.)*
3. **iOS Options:**
   - **Zero-cost option:** Users install the free official **WireGuard** iOS client from the App Store and scan the QR code from `GET /api/v1/peers/{id}/qr`.
   - **Custom branded iOS app:** Requires macOS + Xcode (see [mobile/ios/IOS_BUILD_GUIDE.md](mobile/ios/IOS_BUILD_GUIDE.md); TestFlight distribution requires an Apple Developer account).

## Local Verification (Windows / Linux / macOS)

### Backend API & Tests
```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
# Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt
pytest -v
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Mobile TypeScript & Jest Tests
```bash
cd mobile
npm install
npm run typecheck
npm test
```
