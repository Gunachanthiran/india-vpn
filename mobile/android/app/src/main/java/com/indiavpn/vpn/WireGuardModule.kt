package com.indiavpn.vpn

import android.app.Activity
import android.content.Intent
import android.net.VpnService
import android.os.Build
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.wireguard.android.backend.Tunnel
import com.wireguard.crypto.KeyPair

class WireGuardModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), ActivityEventListener {

    companion object {
        private const val VPN_PERMISSION_REQUEST_CODE = 4201
        private const val STATUS_EVENT = "WireGuardStatusChanged"
    }

    private var pendingConfig: String? = null
    private var pendingTunnelName: String = "india-wg0"
    private var pendingPromise: Promise? = null

    init {
        reactContext.addActivityEventListener(this)
        WireGuardVpnService.stateListener = { state, error ->
            val mapped = when (state) {
                Tunnel.State.UP -> "connected"
                Tunnel.State.DOWN -> if (error != null) "error" else "disconnected"
                Tunnel.State.TOGGLE -> "connecting"
            }
            val payload = Arguments.createMap().apply {
                putString("status", mapped)
                if (error != null) putString("error", error)
            }
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(STATUS_EVENT, payload)
        }
    }

    override fun getName(): String = "WireGuardTunnel"

    @ReactMethod
    fun generateKeyPair(promise: Promise) {
        runCatching {
            val kp = KeyPair()
            Arguments.createMap().apply {
                putString("privateKey", kp.privateKey.toBase64())
                putString("publicKey", kp.publicKey.toBase64())
            }
        }.onSuccess { promise.resolve(it) }
            .onFailure { promise.reject("WG_KEYGEN_ERR", it) }
    }

    @ReactMethod
    fun connect(configText: String, tunnelName: String, promise: Promise) {
        val prepareIntent = VpnService.prepare(reactContext)
        if (prepareIntent != null) {
            val activity = reactContext.currentActivity
            if (activity == null) {
                promise.reject("NO_ACTIVITY", "Cannot request Android VPN consent without foreground Activity")
                return
            }
            pendingConfig = configText
            pendingTunnelName = tunnelName
            pendingPromise = promise
            activity.startActivityForResult(prepareIntent, VPN_PERMISSION_REQUEST_CODE)
            return
        }
        startVpnService(configText, tunnelName)
        promise.resolve(null)
    }

    @ReactMethod
    fun disconnect(promise: Promise) {
        val intent = Intent(reactContext, WireGuardVpnService::class.java).apply {
            action = WireGuardVpnService.ACTION_DISCONNECT
        }
        reactContext.startService(intent)
        promise.resolve(null)
    }

    @ReactMethod
    fun getStatus(promise: Promise) {
        val status = when (WireGuardVpnService.currentState) {
            Tunnel.State.UP -> "connected"
            Tunnel.State.DOWN -> "disconnected"
            Tunnel.State.TOGGLE -> "connecting"
        }
        promise.resolve(status)
    }

    private fun startVpnService(configText: String, tunnelName: String) {
        val intent = Intent(reactContext, WireGuardVpnService::class.java).apply {
            action = WireGuardVpnService.ACTION_CONNECT
            putExtra(WireGuardVpnService.EXTRA_CONFIG, configText)
            putExtra(WireGuardVpnService.EXTRA_TUNNEL_NAME, tunnelName)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            reactContext.startForegroundService(intent)
        } else {
            reactContext.startService(intent)
        }
    }

    override fun onActivityResult(activity: Activity?, requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode != VPN_PERMISSION_REQUEST_CODE) return
        val promise = pendingPromise ?: return
        val cfg = pendingConfig
        pendingPromise = null
        pendingConfig = null

        if (resultCode == Activity.RESULT_OK && cfg != null) {
            startVpnService(cfg, pendingTunnelName)
            promise.resolve(null)
        } else {
            promise.reject("VPN_PERMISSION_DENIED", "User denied Android VpnService permission")
        }
    }

    override fun onNewIntent(intent: Intent?) = Unit
}
