package com.indiavpn.vpn

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Intent
import android.net.VpnService
import android.os.Build
import com.wireguard.android.backend.GoBackend
import com.wireguard.android.backend.Tunnel
import com.wireguard.config.Config
import java.io.BufferedReader
import java.io.StringReader

/**
 * Android VpnService hosting WireGuard's userspace GoBackend tunnel.
 */
class WireGuardVpnService : VpnService() {

    companion object {
        const val ACTION_CONNECT = "com.indiavpn.action.CONNECT"
        const val ACTION_DISCONNECT = "com.indiavpn.action.DISCONNECT"
        const val EXTRA_CONFIG = "wg_config"
        const val EXTRA_TUNNEL_NAME = "tunnel_name"
        private const val CHANNEL_ID = "india_vpn_tunnel"
        private const val NOTIFICATION_ID = 1001

        @Volatile
        var stateListener: ((Tunnel.State, String?) -> Unit)? = null

        @Volatile
        var currentState: Tunnel.State = Tunnel.State.DOWN
            private set
    }

    private lateinit var backend: GoBackend
    private var activeTunnel: NamedTunnel? = null

    override fun onCreate() {
        super.onCreate()
        backend = GoBackend(applicationContext)
        ensureNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_CONNECT -> {
                val configText = intent.getStringExtra(EXTRA_CONFIG) ?: return START_NOT_STICKY
                val tunnelName = intent.getStringExtra(EXTRA_TUNNEL_NAME) ?: "india-wg0"
                startForeground(NOTIFICATION_ID, buildNotification("Connecting to $tunnelName"))
                Thread {
                    runCatching {
                        val parsedConfig = Config.parse(BufferedReader(StringReader(configText)))
                        val tunnel = NamedTunnel(tunnelName) { newState ->
                            currentState = newState
                            stateListener?.invoke(newState, null)
                        }
                        activeTunnel = tunnel
                        backend.setState(tunnel, Tunnel.State.UP, parsedConfig)
                        currentState = Tunnel.State.UP
                        stateListener?.invoke(Tunnel.State.UP, null)
                        val nm = getSystemService(NotificationManager::class.java)
                        nm.notify(NOTIFICATION_ID, buildNotification("Connected ($tunnelName)"))
                    }.onFailure { err ->
                        currentState = Tunnel.State.DOWN
                        stateListener?.invoke(Tunnel.State.DOWN, err.localizedMessage)
                        stopForeground(STOP_FOREGROUND_REMOVE)
                        stopSelf()
                    }
                }.start()
            }

            ACTION_DISCONNECT -> {
                Thread {
                    runCatching {
                        activeTunnel?.let { backend.setState(it, Tunnel.State.DOWN, null) }
                    }
                    currentState = Tunnel.State.DOWN
                    stateListener?.invoke(Tunnel.State.DOWN, null)
                    stopForeground(STOP_FOREGROUND_REMOVE)
                    stopSelf()
                }.start()
            }
        }
        return START_STICKY
    }

    override fun onDestroy() {
        runCatching {
            activeTunnel?.let { backend.setState(it, Tunnel.State.DOWN, null) }
        }
        currentState = Tunnel.State.DOWN
        super.onDestroy()
    }

    private fun ensureNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "India WireGuard VPN",
                NotificationManager.IMPORTANCE_LOW
            )
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
    }

    private fun buildNotification(text: String): Notification {
        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, CHANNEL_ID)
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
        }
        return builder
            .setContentTitle("India WireGuard VPN")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_lock_lock)
            .setOngoing(true)
            .build()
    }

    private class NamedTunnel(
        private val tunnelName: String,
        private val onChange: (Tunnel.State) -> Unit
    ) : Tunnel {
        override fun getName(): String = tunnelName
        override fun onStateChange(newState: Tunnel.State) {
            onChange(newState)
        }
    }
}
