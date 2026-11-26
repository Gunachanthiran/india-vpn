import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {TunnelStatus} from '../types/vpn';

interface ConnectButtonProps {
  status: TunnelStatus;
  loading: boolean;
  onPress: () => void;
}

export const ConnectButton: React.FC<ConnectButtonProps> = ({
  status,
  loading,
  onPress,
}) => {
  const isConnected = status === 'connected';
  const isBusy =
    loading || status === 'connecting' || status === 'disconnecting';

  const ringColor = isConnected
    ? '#10B981'
    : status === 'error'
      ? '#EF4444'
      : '#FF9933';

  return (
    <TouchableOpacity
      style={[styles.outerRing, {borderColor: ringColor}]}
      onPress={onPress}
      disabled={isBusy}
      activeOpacity={0.85}
      testID="connect-button">
      <View
        style={[
          styles.innerCircle,
          {backgroundColor: isConnected ? '#065F46' : '#1E293B'},
        ]}>
        {isBusy ? (
          <ActivityIndicator size="large" color="#F8FAFC" />
        ) : (
          <>
            <Text style={styles.actionText}>
              {isConnected ? 'DISCONNECT' : 'CONNECT'}
            </Text>
            <Text style={styles.subText}>
              {isConnected ? 'Tap to stop tunnel' : 'WireGuard UDP'}
            </Text>
          </>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  outerRing: {
    width: 196,
    height: 196,
    borderRadius: 98,
    borderWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginVertical: 24,
  },
  innerCircle: {
    width: 172,
    height: 172,
    borderRadius: 86,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionText: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  subText: {
    color: '#CBD5E1',
    fontSize: 12,
    marginTop: 6,
  },
});
