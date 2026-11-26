# India WireGuard VPN — Mobile Client

React Native (TypeScript) client targeting **Android** (`VpnService` + `com.wireguard.android:tunnel`) and **iOS** (`NEPacketTunnelProvider` + `WireGuardKit`).

## Local Development & Verification (Windows / macOS / Linux)

```bash
cd mobile
npm install
npm run typecheck
npm test
```

- **Default Backend URL:**
  - Android Emulator: `http://10.0.2.2:8000`
  - iOS / Localhost: `http://127.0.0.1:8000`
  - You can override the API URL directly on the sign-in screen for deployed India VPS endpoints (`https://api.vpn-bom.example.com`).

## Native Tunnel Bridges

- **Android (`android/app/src/main/java/com/indiavpn/vpn/`):**
  - `WireGuardVpnService.kt`: Android `VpnService` hosting WireGuard's `GoBackend` with foreground notification.
  - `WireGuardModule.kt`: React Native `NativeModule` (`WireGuardTunnel`) handling `VpnService.prepare(...)` consent, keypair generation via `com.wireguard.crypto.KeyPair`, and tunnel status events.
- **iOS (`ios/`):**
  - `IndiaVpnApp/WireGuardBridge.swift` & `.m`: `RCTEventEmitter` managing `NETunnelProviderManager` and `Curve25519` key generation via `CryptoKit`.
  - `IndiaVpnExtension/PacketTunnelProvider.swift`: `NEPacketTunnelProvider` subclass powered by `WireGuardKit`.
  - See [ios/IOS_BUILD_GUIDE.md](ios/IOS_BUILD_GUIDE.md) for macOS + Xcode + Apple Developer entitlement setup.
