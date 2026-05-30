import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from './src/navigation/RootNavigator';
import { marketSocket } from './src/services/marketSocket';
import { useWatchlistStore } from './src/store/watchlistStore';
import { API_URL } from './src/config';

export default function App() {
  const loadWatchlist = useWatchlistStore((s) => s.load);

  useEffect(() => {
    void loadWatchlist();
    marketSocket.connect(API_URL);
    return () => marketSocket.disconnect();
  }, [loadWatchlist]);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <RootNavigator />
    </SafeAreaProvider>
  );
}
