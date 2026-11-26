import React from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {ServerCard} from '../components/ServerCard';
import {useVpn} from '../context/VpnContext';
import {ServerNode} from '../types/vpn';

export const ServersScreen: React.FC<{onSelectDone: () => void}> = ({
  onSelectDone,
}) => {
  const {servers, selectedServer, selectServer, refreshServers, loading} =
    useVpn();

  const handleSelect = (server: ServerNode) => {
    selectServer(server);
    onSelectDone();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>India Gateways</Text>
          <Text style={styles.subtitle}>
            Select the lowest-latency WireGuard exit node
          </Text>
        </View>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={refreshServers}
          disabled={loading}>
          <Text style={styles.refreshText}>
            {loading ? 'Syncing...' : 'Refresh'}
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={servers}
        keyExtractor={item => String(item.id)}
        renderItem={({item}) => (
          <ServerCard
            server={item}
            selected={selectedServer?.id === item.id}
            onSelect={handleSelect}
          />
        )}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Text style={styles.empty}>No active India VPN nodes available.</Text>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1120',
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '800',
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  refreshBtn: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  refreshText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '700',
  },
  listContent: {
    paddingBottom: 24,
  },
  empty: {
    color: '#64748B',
    textAlign: 'center',
    marginTop: 40,
  },
});
