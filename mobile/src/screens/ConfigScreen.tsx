import React, {useState} from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {useVpn} from '../context/VpnContext';

export const ConfigScreen: React.FC<{onSaved?: () => void}> = ({onSaved}) => {
  const {
    directConfig,
    directConfigName,
    saveDirectConfig,
    clearDirectConfig,
    activeProvision,
    rotateDeviceKeyAndReprovision,
    loading,
  } = useVpn();

  const [label, setLabel] = useState(directConfigName);
  const [rawText, setRawText] = useState(directConfig ?? '');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSave = () => {
    setLocalError(null);
    try {
      saveDirectConfig(rawText, label);
      onSaved?.();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Invalid config');
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}>
      <Text style={styles.title}>Quick India Setup (No Login Needed)</Text>
      <Text style={styles.subtitle}>
        Paste the WireGuard config (.conf) from your Indian server or router,
        then tap Save & Use Config.
      </Text>

      {localError ? <Text style={styles.errorText}>{localError}</Text> : null}

      <Text style={styles.label}>Profile Name</Text>
      <TextInput
        style={styles.input}
        value={label}
        onChangeText={setLabel}
        placeholder="Mumbai BGMI Node"
        placeholderTextColor="#64748B"
      />

      <Text style={styles.label}>WireGuard Config (.conf)</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={rawText}
        onChangeText={setRawText}
        multiline
        autoCapitalize="none"
        autoCorrect={false}
        textAlignVertical="top"
        placeholder={
          '[Interface]\nPrivateKey = ...\nAddress = 10.8.0.2/32\n\n[Peer]\nPublicKey = ...\nAllowedIPs = 0.0.0.0/0\nEndpoint = <INDIA_IP>:51820'
        }
        placeholderTextColor="#475569"
      />

      <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
        <Text style={styles.saveBtnText}>Save & Use Config</Text>
      </TouchableOpacity>

      {directConfig ? (
        <TouchableOpacity
          style={styles.clearBtn}
          onPress={() => {
            clearDirectConfig();
            setRawText('');
          }}>
          <Text style={styles.clearBtnText}>Clear Saved Direct Config</Text>
        </TouchableOpacity>
      ) : null}

      {activeProvision ? (
        <View style={styles.cloudBox}>
          <Text style={styles.cloudTitle}>Active Cloud Profile</Text>
          <Text style={styles.metaLine}>
            Gateway: {activeProvision.peer.server_name} (
            {activeProvision.peer.assigned_ip}/32)
          </Text>
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
              {loading ? 'Rotating...' : 'Rotate Cloud Keys'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
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
    marginBottom: 14,
    lineHeight: 18,
  },
  errorText: {
    backgroundColor: '#450A0A',
    color: '#FCA5A5',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
    fontSize: 13,
  },
  label: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#0F172A',
    color: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
  },
  textArea: {
    minHeight: 170,
    fontFamily: 'monospace',
    color: '#34D399',
  },
  saveBtn: {
    backgroundColor: '#FF9933',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 16,
  },
  saveBtnText: {
    color: '#0F172A',
    fontWeight: '800',
    fontSize: 15,
  },
  clearBtn: {
    backgroundColor: '#1E293B',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
    marginTop: 10,
  },
  clearBtnText: {
    color: '#94A3B8',
    fontWeight: '600',
    fontSize: 13,
  },
  cloudBox: {
    marginTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#1F2937',
    paddingTop: 16,
  },
  cloudTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
  },
  metaLine: {
    color: '#CBD5E1',
    fontSize: 12,
    marginBottom: 8,
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
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#FF9933',
  },
  rotateBtnText: {
    color: '#FF9933',
    fontWeight: '700',
    fontSize: 13,
  },
});
