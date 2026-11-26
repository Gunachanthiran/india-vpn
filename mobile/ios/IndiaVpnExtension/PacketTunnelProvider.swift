import Foundation
import NetworkExtension
import WireGuardKit

/**
 * iOS NetworkExtension target running inside the `IndiaVpnExtension` app extension.
 * Requires the `com.apple.developer.networking.networkextension` (packet-tunnel-provider)
 * entitlement from an Apple Developer account and WireGuardKit linked via SwiftPM/CocoaPods.
 */
class PacketTunnelProvider: NEPacketTunnelProvider {
  private lazy var adapter: WireGuardAdapter = {
    return WireGuardAdapter(with: self) { logLevel, message in
      NSLog("[IndiaVPN WireGuard][%@] %@", String(describing: logLevel), message)
    }
  }()

  override func startTunnel(
    options: [String: NSObject]?,
    completionHandler: @escaping (Error?) -> Void
  ) {
    guard
      let protocolConfig = self.protocolConfiguration as? NETunnelProviderProtocol,
      let providerConfig = protocolConfig.providerConfiguration,
      let wgQuickConfig = providerConfig["wgQuickConfig"] as? String
    else {
      completionHandler(NSError(domain: "com.indiavpn.tunnel", code: 1, userInfo: [
        NSLocalizedDescriptionKey: "Missing wgQuickConfig in NETunnelProviderProtocol"
      ]))
      return
    }

    do {
      let tunnelConfiguration = try TunnelConfiguration(fromWgQuickConfig: wgQuickConfig)
      adapter.start(tunnelConfiguration: tunnelConfiguration) { adapterError in
        if let adapterError = adapterError {
          completionHandler(adapterError)
          return
        }
        completionHandler(nil)
      }
    } catch {
      completionHandler(error)
    }
  }

  override func stopTunnel(
    with reason: NEProviderStopReason,
    completionHandler: @escaping () -> Void
  ) {
    adapter.stop { _ in
      completionHandler()
    }
  }
}
