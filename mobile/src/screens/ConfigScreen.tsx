import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {useVpn} from '../context/VpnContext';

export const ConfigScreen: React.FC = () => {
  const {activeProvision, rotateDeviceKeyAndReprovision, loading} = useVpn();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}>
      <Text style={styles.title}>WireGuard Tunnel Profile</Text>
      <Text style={styles.subtitle}>
        Active peer keys and wg-quick configuration synced from the control
        plane.
      </Text>

      {activeProvision ? (
        <>
          <View style={styles.metaBox}>
            <Text style={styles.metaLine}>
              Device: {activeProvision.peer.device_name}
            </Text>
            <Text style={styles.metaLine}>
              Gateway: {activeProvision.peer.server_name}
            </Text>
            <Text style={styles.metaLine}>
              Public Key: {activeProvision.peer.public_key}
            </Text>
            <Text style={styles.metaLine}>
              Assigned IP: {activeProvision.peer.assigned_ip}/32
            </Text>
          </View>

          <View style={styles.codeBox}>
            <Text style={styles.codeText} selectable>
              {activeProvision.wg_quick_config}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.rotateBtn}
            onPress={rotateDeviceKeyAndReprovision}
            disabled={loading}>
            <Text style={styles.rotateBtnText}>
              {loading ? 'Rotating...' : 'Rotate WireGuard Keys & Re-Provision'}
            </Text>
          </TouchableOpacity>
        </>
      ) : (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>
            Connect to an India server first to provision a WireGuard peer
            profile.
          </Text>
        </View>
      )}
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
  title: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '800',
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 4,
    marginBottom: 16,
  },
  metaBox: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1F2937',
    marginBottom: 14,
  },
  metaLine: {
    color: '#CBD5E1',
    fontSize: 12,
    marginBottom: 4,
  },
  codeBox: {
    backgroundColor: '#020617',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  codeText: {
    color: '#34D399',
    fontFamily: 'monospace',
    fontSize: 12,
    lineHeight: 18,
  },
  rotateBtn: {
    backgroundColor: '#1E293B',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#FF9933',
  },
  rotateBtnText: {
    color: '#FF9933',
    fontWeight: '700',
    fontSize: 14,
  },
  emptyBox: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 14,
    lineHeight: 20,
  },
});
