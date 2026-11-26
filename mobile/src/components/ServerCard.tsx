import React from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {ServerNode} from '../types/vpn';

interface ServerCardProps {
  server: ServerNode;
  selected: boolean;
  onSelect: (server: ServerNode) => void;
}

export const ServerCard: React.FC<ServerCardProps> = ({
  server,
  selected,
  onSelect,
}) => {
  return (
    <TouchableOpacity
      style={[styles.card, selected && styles.selectedCard]}
      onPress={() => onSelect(server)}
      activeOpacity={0.8}>
      <View style={styles.headerRow}>
        <View style={styles.titleBlock}>
          <Text style={styles.city}>{server.city}</Text>
          <Text style={styles.subtitle}>
            {server.provider} • {server.region_code}
          </Text>
        </View>
        <View style={styles.latencyPill}>
          <Text style={styles.latencyText}>{server.latency_ms_estimate} ms</Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        <Text style={styles.endpoint}>
          {server.endpoint_host}:{server.listen_port}
        </Text>
        <Text style={styles.loadText}>
          Load {server.load_percent}% ({server.active_peers}/{server.max_peers})
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#111827',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  selectedCard: {
    borderColor: '#FF9933',
    backgroundColor: '#181E2E',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleBlock: {
    flex: 1,
  },
  city: {
    color: '#F8FAFC',
    fontSize: 17,
    fontWeight: '700',
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 2,
  },
  latencyPill: {
    backgroundColor: '#064E3B',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  latencyText: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  endpoint: {
    color: '#64748B',
    fontSize: 12,
  },
  loadText: {
    color: '#CBD5E1',
    fontSize: 12,
  },
});
