import React, {useState} from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {VpnProvider, useVpn} from './context/VpnContext';
import {AuthScreen} from './screens/AuthScreen';
import {ConfigScreen} from './screens/ConfigScreen';
import {HomeScreen} from './screens/HomeScreen';
import {ServersScreen} from './screens/ServersScreen';

type Tab = 'home' | 'servers' | 'config';

const MainShell: React.FC = () => {
  const {user} = useVpn();
  const [tab, setTab] = useState<Tab>('home');

  if (!user) {
    return <AuthScreen />;
  }

  return (
    <View style={styles.shell}>
      <View style={styles.body}>
        {tab === 'home' ? (
          <HomeScreen onOpenServers={() => setTab('servers')} />
        ) : null}
        {tab === 'servers' ? (
          <ServersScreen onSelectDone={() => setTab('home')} />
        ) : null}
        {tab === 'config' ? <ConfigScreen /> : null}
      </View>

      <View style={styles.tabBar}>
        {(['home', 'servers', 'config'] as Tab[]).map(item => (
          <TouchableOpacity
            key={item}
            style={[styles.tabItem, tab === item && styles.activeTab]}
            onPress={() => setTab(item)}>
            <Text
              style={[styles.tabText, tab === item && styles.activeTabText]}>
              {item === 'home'
                ? 'Tunnel'
                : item === 'servers'
                  ? 'India Nodes'
                  : 'Profile'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

export const App: React.FC = () => {
  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#0B1120" />
      <VpnProvider>
        <MainShell />
      </VpnProvider>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0B1120',
  },
  shell: {
    flex: 1,
  },
  body: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#111827',
    borderTopWidth: 1,
    borderTopColor: '#1F2937',
  },
  tabItem: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  activeTab: {
    borderTopWidth: 2,
    borderTopColor: '#FF9933',
  },
  tabText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '700',
  },
  activeTabText: {
    color: '#F8FAFC',
  },
});

export default App;
