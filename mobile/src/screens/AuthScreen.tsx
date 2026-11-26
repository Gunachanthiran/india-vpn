import React, {useState} from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {useVpn} from '../context/VpnContext';

export const AuthScreen: React.FC = () => {
  const {apiBaseUrl, setApiBaseUrl, signIn, signUp, loading, error} = useVpn();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');

  const handleSubmit = async () => {
    if (!email.trim() || !password) {
      return;
    }
    if (mode === 'login') {
      await signIn(email.trim(), password).catch(() => undefined);
    } else {
      await signUp(email.trim(), password, fullName.trim() || 'VPN User').catch(
        () => undefined,
      );
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.card}>
        <Text style={styles.brand}>INDIA WIREGUARD VPN</Text>
        <Text style={styles.subtitle}>
          Encrypted WireGuard gateways across Mumbai, Hyderabad, Bangalore,
          Delhi NCR & Chennai
        </Text>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Text style={styles.label}>Control Plane API URL</Text>
        <TextInput
          style={styles.input}
          value={apiBaseUrl}
          onChangeText={setApiBaseUrl}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="https://api.indiavpn.example.com"
          placeholderTextColor="#64748B"
        />

        {mode === 'register' ? (
          <>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Aarav Sharma"
              placeholderTextColor="#64748B"
            />
          </>
        ) : null}

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="you@example.in"
          placeholderTextColor="#64748B"
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="••••••••"
          placeholderTextColor="#64748B"
        />

        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={handleSubmit}
          disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#0F172A" />
          ) : (
            <Text style={styles.primaryBtnText}>
              {mode === 'login' ? 'Sign In' : 'Create Account'}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.switchBtn}
          onPress={() =>
            setMode(prev => (prev === 'login' ? 'register' : 'login'))
          }>
          <Text style={styles.switchBtnText}>
            {mode === 'login'
              ? 'New user? Register an account'
              : 'Already registered? Sign in'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1120',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  brand: {
    color: '#FF9933',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 1,
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 6,
    marginBottom: 16,
    lineHeight: 18,
  },
  label: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 10,
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
    fontSize: 14,
  },
  errorText: {
    backgroundColor: '#450A0A',
    color: '#FCA5A5',
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
    fontSize: 13,
  },
  primaryBtn: {
    backgroundColor: '#FF9933',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 18,
  },
  primaryBtnText: {
    color: '#0F172A',
    fontWeight: '800',
    fontSize: 15,
  },
  switchBtn: {
    marginTop: 14,
    alignItems: 'center',
  },
  switchBtnText: {
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: '600',
  },
});
