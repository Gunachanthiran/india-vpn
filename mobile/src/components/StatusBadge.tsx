import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {TunnelStatus} from '../types/vpn';

const STATUS_META: Record<
  TunnelStatus,
  {label: string; color: string; bg: string}
> = {
  disconnected: {label: 'DISCONNECTED', color: '#94A3B8', bg: '#1E293B'},
  connecting: {label: 'CONNECTING...', color: '#FBBF24', bg: '#451A03'},
  connected: {label: 'PROTECTED • INDIA WG', color: '#34D399', bg: '#064E3B'},
  disconnecting: {label: 'DISCONNECTING...', color: '#FBBF24', bg: '#451A03'},
  error: {label: 'CONNECTION ERROR', color: '#F87171', bg: '#450A0A'},
};

export const StatusBadge: React.FC<{status: TunnelStatus}> = ({status}) => {
  const meta = STATUS_META[status];
  return (
    <View style={[styles.badge, {backgroundColor: meta.bg}]}>
      <View style={[styles.dot, {backgroundColor: meta.color}]} />
      <Text style={[styles.text, {color: meta.color}]}>{meta.label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.7,
  },
});
