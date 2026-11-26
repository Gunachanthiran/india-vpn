import Foundation
import NetworkExtension
import WireGuardKit

private enum WgQuickParseError: LocalizedError {
  case invalidConfig(String)

  var errorDescription: String? {
    switch self {
    case .invalidConfig(let reason):
      return "Invalid WireGuard config: \(reason)"
    }
  }
}

/// iOS NetworkExtension target running inside `IndiaVpnExtension`.
/// Requires the `com.apple.developer.networking.networkextension` (`packet-tunnel-provider`)
/// entitlement when signed for physical iOS devices.
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
      completionHandler(WgQuickParseError.invalidConfig("Missing wgQuickConfig in NETunnelProviderProtocol"))
      return
    }

    do {
      let tunnelConfiguration = try Self.parseWgQuickConfig(wgQuickConfig)
      adapter.start(tunnelConfiguration: tunnelConfiguration) { adapterError in
        completionHandler(adapterError)
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

  private static func parseWgQuickConfig(_ text: String) throws -> TunnelConfiguration {
    enum Section { case none, interface, peer }

    var section: Section = .none
    var interfacePrivateKey: PrivateKey?
    var addresses: [IPAddressRange] = []
    var dnsServers: [DNSServer] = []
    var mtu: UInt16?
    var listenPort: UInt16?

    var peers: [PeerConfiguration] = []
    var currentPeerPubKey: PublicKey?
    var currentPeerPsk: PreSharedKey?
    var currentAllowedIPs: [IPAddressRange] = []
    var currentEndpoint: Endpoint?
    var currentKeepalive: UInt16?

    func flushCurrentPeer() {
      guard let pub = currentPeerPubKey else { return }
      var peer = PeerConfiguration(publicKey: pub)
      peer.preSharedKey = currentPeerPsk
      peer.allowedIPs = currentAllowedIPs
      peer.endpoint = currentEndpoint
      peer.persistentKeepAlive = currentKeepalive
      peers.append(peer)

      currentPeerPubKey = nil
      currentPeerPsk = nil
      currentAllowedIPs = []
      currentEndpoint = nil
      currentKeepalive = nil
    }

    for rawLine in text.components(separatedBy: .newlines) {
      let line = rawLine.trimmingCharacters(in: .whitespacesAndNewlines)
      if line.isEmpty || line.hasPrefix("#") || line.hasPrefix(";") {
        continue
      }
      if line.caseInsensitiveCompare("[Interface]") == .orderedSame {
        flushCurrentPeer()
        section = .interface
        continue
      }
      if line.caseInsensitiveCompare("[Peer]") == .orderedSame {
        flushCurrentPeer()
        section = .peer
        continue
      }

      guard let eqIdx = line.firstIndex(of: "=") else { continue }
      let key = line[..<eqIdx].trimmingCharacters(in: .whitespaces).lowercased()
      let value = line[line.index(after: eqIdx)...].trimmingCharacters(in: .whitespaces)

      switch section {
      case .interface:
        switch key {
        case "privatekey":
          interfacePrivateKey = PrivateKey(base64Key: value)
        case "address":
          addresses.append(contentsOf: value.split(separator: ",").compactMap {
            IPAddressRange(from: $0.trimmingCharacters(in: .whitespaces))
          })
        case "dns":
          dnsServers.append(contentsOf: value.split(separator: ",").compactMap {
            DNSServer(from: $0.trimmingCharacters(in: .whitespaces))
          })
        case "mtu":
          mtu = UInt16(value)
        case "listenport":
          listenPort = UInt16(value)
        default:
          break
        }
      case .peer:
        switch key {
        case "publickey":
          currentPeerPubKey = PublicKey(base64Key: value)
        case "presharedkey":
          currentPeerPsk = PreSharedKey(base64Key: value)
        case "allowedips":
          currentAllowedIPs.append(contentsOf: value.split(separator: ",").compactMap {
            IPAddressRange(from: $0.trimmingCharacters(in: .whitespaces))
          })
        case "endpoint":
          currentEndpoint = Endpoint(from: value)
        case "persistentkeepalive":
          currentKeepalive = UInt16(value)
        default:
          break
        }
      case .none:
        break
      }
    }
    flushCurrentPeer()

    guard let privKey = interfacePrivateKey else {
      throw WgQuickParseError.invalidConfig("Missing or invalid Interface PrivateKey")
    }
    guard !peers.isEmpty else {
      throw WgQuickParseError.invalidConfig("No valid [Peer] section found")
    }

    var iface = InterfaceConfiguration(privateKey: privKey)
    iface.addresses = addresses
    iface.dns = dnsServers
    iface.mtu = mtu
    iface.listenPort = listenPort

    return TunnelConfiguration(name: "IndiaVPN", interface: iface, peers: peers)
  }
}
