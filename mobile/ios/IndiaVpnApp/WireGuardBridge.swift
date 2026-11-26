import Foundation
import NetworkExtension
import CryptoKit
import React

@objc(WireGuardTunnel)
class WireGuardBridge: RCTEventEmitter {
  private static let tunnelBundleId = "com.indiavpn.mobile.network-extension"
  private var hasListeners = false

  override init() {
    super.init()
    NotificationCenter.default.addObserver(
      self,
      selector: #selector(handleStatusChange(_:)),
      name: .NEVPNStatusDidChange,
      object: nil
    )
  }

  deinit {
    NotificationCenter.default.removeObserver(self)
  }

  override static func requiresMainQueueSetup() -> Bool {
    return false
  }

  override func supportedEvents() -> [String]! {
    return ["WireGuardStatusChanged"]
  }

  override func startObserving() {
    hasListeners = true
  }

  override func stopObserving() {
    hasListeners = false
  }

  @objc(generateKeyPair:rejecter:)
  func generateKeyPair(
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    let privateKey = Curve25519.KeyAgreement.PrivateKey()
    let privBase64 = privateKey.rawRepresentation.base64EncodedString()
    let pubBase64 = privateKey.publicKey.rawRepresentation.base64EncodedString()
    resolve(["privateKey": privBase64, "publicKey": pubBase64])
  }

  @objc(connect:tunnelName:resolver:rejecter:)
  func connect(
    configText: String,
    tunnelName: String,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    NETunnelProviderManager.loadAllFromPreferences { managers, error in
      if let error = error {
        reject("WG_LOAD_ERR", error.localizedDescription, error)
        return
      }

      let manager = managers?.first(where: {
        ($0.protocolConfiguration as? NETunnelProviderProtocol)?.providerBundleIdentifier == Self.tunnelBundleId
      }) ?? NETunnelProviderManager()

      let proto = NETunnelProviderProtocol()
      proto.providerBundleIdentifier = Self.tunnelBundleId
      proto.serverAddress = "India WireGuard Gateway"
      proto.providerConfiguration = ["wgQuickConfig": configText]

      manager.protocolConfiguration = proto
      manager.localizedDescription = tunnelName
      manager.isEnabled = true

      manager.saveToPreferences { saveError in
        if let saveError = saveError {
          reject("WG_SAVE_ERR", saveError.localizedDescription, saveError)
          return
        }
        manager.loadFromPreferences { reloadError in
          if let reloadError = reloadError {
            reject("WG_RELOAD_ERR", reloadError.localizedDescription, reloadError)
            return
          }
          do {
            try (manager.connection as? NETunnelProviderSession)?.startTunnel(options: nil)
            resolve(nil)
          } catch {
            reject("WG_START_ERR", error.localizedDescription, error)
          }
        }
      }
    }
  }

  @objc(disconnect:rejecter:)
  func disconnect(
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    NETunnelProviderManager.loadAllFromPreferences { managers, error in
      if let error = error {
        reject("WG_LOAD_ERR", error.localizedDescription, error)
        return
      }
      managers?.forEach { manager in
        manager.connection.stopVPNTunnel()
      }
      resolve(nil)
    }
  }

  @objc(getStatus:rejecter:)
  func getStatus(
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    NETunnelProviderManager.loadAllFromPreferences { managers, error in
      if let error = error {
        reject("WG_STATUS_ERR", error.localizedDescription, error)
        return
      }
      guard let manager = managers?.first else {
        resolve("disconnected")
        return
      }
      resolve(Self.mapStatus(manager.connection.status))
    }
  }

  @objc private func handleStatusChange(_ notification: Notification) {
    guard hasListeners, let session = notification.object as? NEVPNConnection else { return }
    sendEvent(withName: "WireGuardStatusChanged", body: ["status": Self.mapStatus(session.status)])
  }

  private static func mapStatus(_ status: NEVPNStatus) -> String {
    switch status {
    case .connected:
      return "connected"
    case .connecting, .reasserting:
      return "connecting"
    case .disconnecting:
      return "disconnecting"
    case .disconnected, .invalid:
      return "disconnected"
    @unknown default:
      return "disconnected"
    }
  }
}
