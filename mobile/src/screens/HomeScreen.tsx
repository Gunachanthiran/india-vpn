import React from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {ConnectButton} from '../components/ConnectButton';
import {StatusBadge} from '../components/StatusBadge';
import {useVpn} from '../context/VpnContext';
import {parseWgQuickSummary} from '../services/wireguard';

function formatDuration(totalSeconds: number): string {
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  return [hrs, mins, secs].map(n => String(n).padStart(2, '0')).join(':');
}

export const HomeScreen: React.FC<{
  onOpenSetup: () => void;
  onOpenServers: () => void;
}> = ({onOpenSetup, onOpenServers}) => {
  const {
    user,
    selectedServer,
    activeProvision,
    directConfig,
    directConfigName,
    tunnelStatus,
    connectedSeconds,
    measuredRttMs,
    gamingMode,
    setGamingMode,
    bgmiSplitTunnel,
    setBgmiSplitTunnel,
    complianceMode,
    nativeBackendLabel,
    loading,
    error,
    toggleConnection,
    signOut,
  } = useVpn();

  const directSummary = directConfig ? parseWgQuickSummary(directConfig) : null;
  const hasAnyProfile = Boolean(directConfig || selectedServer);

  const handlePrimaryPress = () => {
    if (!hasAnyProfile && tunnelStatus === 'disconnected') {
      onOpenSetup();
      return;
    }
    toggleConnection();
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}>
      <View style={styles.topBar}>
        <View>
          <Text style={styles.greeting}>
            {user ? `Namaste, ${user.full_name}` : 'India WireGuard VPN'}
          </Text>
          <Text style={styles.backendTag}>{nativeBackendLabel}</Text>
        </View>
        {user ? (
          <TouchableOpacity onPress={signOut} style={styles.signOutBtn}>
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <StatusBadge status={tunnelStatus} />

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <ConnectButton
        status={tunnelStatus}
        loading={loading}
        onPress={handlePrimaryPress}
      />

      <Text style={styles.timer}>
        {tunnelStatus === 'connected'
          ? `Session Duration: ${formatDuration(connectedSeconds)}`
          : hasAnyProfile
            ? 'Ready to Connect'
            : 'Tap Connect or Setup Config to paste your India .conf'}
      </Text>

      <TouchableOpacity
        style={styles.serverSelector}
        onPress={directConfig || !user ? onOpenSetup : onOpenServers}>
        <View style={styles.selectorTextWrap}>
          <Text style={styles.selectorLabel}>
            {directConfig ? 'DIRECT WIREGUARD PROFILE' : 'ACTIVE INDIA GATEWAY'}
          </Text>
          <Text style={styles.selectorValue}>
            {directConfig
              ? directConfigName
              : selectedServer
                ? `${selectedServer.city} (${selectedServer.provider})`
                : 'No server configured yet'}
          </Text>
          <Text style={styles.selectorSub}>
            {directSummary
              ? `${directSummary.endpoint} • ${directSummary.address}`
              : selectedServer
                ? `${selectedServer.endpoint_host}:${selectedServer.listen_port} • ${
                    measuredRttMs !== null
                      ? `Measured ${measuredRttMs} ms`
                      : `~${selectedServer.latency_ms_estimate} ms`
                  }`
                : 'Tap here to paste a WireGuard config (no login needed)'}
          </Text>
        </View>
        <Text style={styles.changeLink}>
          {hasAnyProfile ? 'Change' : 'Setup'}
        </Text>
      </TouchableOpacity>

      <View style={styles.toggleCard}>
        <View style={styles.toggleRow}>
          <View style={styles.toggleTextBlock}>
            <Text style={styles.toggleTitle}>BGMI Gaming Profile</Text>
            <Text style={styles.toggleSub}>
              MTU 1360, 15s keepalive, fast DNS (reduces packet loss abroad)
            </Text>
          </View>
          <Switch
            value={gamingMode}
            onValueChange={setGamingMode}
            disabled={tunnelStatus === 'connected' || tunnelStatus === 'connecting'}
          />
        </View>
        {Platform.OS === 'android' ? (
          <View style={[styles.toggleRow, styles.toggleDivider]}>
            <View style={styles.toggleTextBlock}>
              <Text style={styles.toggleTitle}>BGMI-Only Split Tunnel</Text>
              <Text style={styles.toggleSub}>
                Route only com.pubg.imobile via India VPN to avoid background lag
              </Text>
            </View>
            <Switch
              value={bgmiSplitTunnel}
              onValueChange={setBgmiSplitTunnel}
              disabled={
                tunnelStatus === 'connected' || tunnelStatus === 'connecting'
              }
            />
          </View>
        ) : null}
      </View>

      <View style={styles.infoGrid}>
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Assigned Tunnel IP</Text>
          <Text style={styles.infoValue}>
            {directSummary?.address ??
              activeProvision?.peer.assigned_ip ??
              'Auto on connect'}
          </Text>
        </View>
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Mode</Text>
          <Text style={styles.infoValue}>
            {directConfig
              ? 'Direct (Zero-Backend)'
              : complianceMode === 'cert_in_audit'
                ? 'Cloud (CERT-In)'
                : 'Cloud (Zero-Log)'}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1120',
  },
  contentContainer: {
    padding: 20,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  greeting: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '800',
  },
  backendTag: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 2,
  },
  signOutBtn: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  signOutText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '600',
  },
  errorBox: {
    backgroundColor: '#450A0A',
    padding: 12,
    borderRadius: 10,
    marginTop: 12,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 13,
  },
  timer: {
    color: '#94A3B8',
    textAlign: 'center',
    fontSize: 13,
    marginBottom: 20,
    fontVariant: ['tabular-nums'],
  },
  serverSelector: {
    backgroundColor: '#111827',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1F2937',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  selectorTextWrap: {
    flex: 1,
    paddingRight: 10,
  },
  selectorLabel: {
    color: '#FF9933',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  selectorValue: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 4,
  },
  selectorSub: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 3,
  },
  changeLink: {
    color: '#38BDF8',
    fontWeight: '700',
    fontSize: 13,
  },
  toggleCard: {
    backgroundColor: '#111827',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1F2937',
    marginBottom: 14,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleDivider: {
    borderTopWidth: 1,
    borderTopColor: '#1F2937',
    marginTop: 12,
    paddingTop: 12,
  },
  toggleTextBlock: {
    flex: 1,
    paddingRight: 12,
  },
  toggleTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
  },
  toggleSub: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  infoGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  infoCard: {
    flex: 1,
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  infoLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  infoValue: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 6,
  },
});
