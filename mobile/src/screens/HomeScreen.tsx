import React from 'react';
import {ScrollView, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {ConnectButton} from '../components/ConnectButton';
import {StatusBadge} from '../components/StatusBadge';
import {useVpn} from '../context/VpnContext';

function formatDuration(totalSeconds: number): string {
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  return [hrs, mins, secs].map(n => String(n).padStart(2, '0')).join(':');
}

export const HomeScreen: React.FC<{onOpenServers: () => void}> = ({
  onOpenServers,
}) => {
  const {
    user,
    selectedServer,
    activeProvision,
    tunnelStatus,
    connectedSeconds,
    complianceMode,
    nativeBackendLabel,
    loading,
    error,
    toggleConnection,
    signOut,
  } = useVpn();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}>
      <View style={styles.topBar}>
        <View>
          <Text style={styles.greeting}>Namaste, {user?.full_name}</Text>
          <Text style={styles.backendTag}>{nativeBackendLabel}</Text>
        </View>
        <TouchableOpacity onPress={signOut} style={styles.signOutBtn}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
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
        onPress={toggleConnection}
      />

      <Text style={styles.timer}>
        {tunnelStatus === 'connected'
          ? `Session Duration: ${formatDuration(connectedSeconds)}`
          : 'Tunnel Idle'}
      </Text>

      <TouchableOpacity style={styles.serverSelector} onPress={onOpenServers}>
        <View>
          <Text style={styles.selectorLabel}>ACTIVE INDIA GATEWAY</Text>
          <Text style={styles.selectorValue}>
            {selectedServer
              ? `${selectedServer.city} (${selectedServer.provider})`
              : 'Tap to choose an India node'}
          </Text>
          {selectedServer ? (
            <Text style={styles.selectorSub}>
              {selectedServer.endpoint_host}:{selectedServer.listen_port} • ~
              {selectedServer.latency_ms_estimate} ms
            </Text>
          ) : null}
        </View>
        <Text style={styles.changeLink}>Change</Text>
      </TouchableOpacity>

      <View style={styles.infoGrid}>
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Assigned Tunnel IP</Text>
          <Text style={styles.infoValue}>
            {activeProvision?.peer.assigned_ip ?? 'Auto on connect'}
          </Text>
        </View>
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Compliance Policy</Text>
          <Text style={styles.infoValue}>
            {complianceMode === 'cert_in_audit'
              ? 'CERT-In Audit (5Y)'
              : 'Private (Zero-Log)'}
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
    fontWeight: '700',
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
    fontSize: 14,
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
