import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {Text} from 'react-native';
import {MarketsScreen} from '../screens/MarketsScreen';
import {WatchlistScreen} from '../screens/WatchlistScreen';
import {PortfolioScreen} from '../screens/PortfolioScreen';
import {MarketDetailScreen} from '../screens/MarketDetailScreen';
import {ConnectionBadge} from '../components/ConnectionBadge';
import {ModalHeader} from '../components/ModalHeader';
import {useMarketStore} from '../store/marketStore';
import type {RootStackParamList, TabParamList} from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const DARK = {
  headerStyle: { backgroundColor: '#0f172a' },
  headerTintColor: '#e2e8f0',
  headerTitleStyle: { fontWeight: '700' as const, color: '#f1f5f9' },
  headerRightContainerStyle: { paddingRight: 14 },
};

function GlobalHeaderRight() {
  const status = useMarketStore((s) => s.connectionStatus);
  return <ConnectionBadge status={status} />;
}

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarStyle: { backgroundColor: '#0f172a', borderTopColor: '#1e293b' },
        tabBarActiveTintColor: '#3b82f6',
        tabBarInactiveTintColor: '#64748b',
        tabBarShowLabel: false,
        headerRight: () => <GlobalHeaderRight />,
        ...DARK,
      }}
    >
      <Tab.Screen
        name="Watchlist"
        component={WatchlistScreen}
        options={{
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>☆</Text>,
          title: 'Watchlist',
        }}
      />
      <Tab.Screen
        name="Markets"
        component={MarketsScreen}
        options={{
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>◎</Text>,
          title: 'Markets',
        }}
      />
      <Tab.Screen
        name="Portfolio"
        component={PortfolioScreen}
        options={{
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>◈</Text>,
          title: 'Portfolio',
        }}
      />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ ...DARK, headerBackButtonDisplayMode: 'minimal' }}>
        <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
        <Stack.Screen
          name="MarketDetail"
          component={MarketDetailScreen}
          options={{ presentation: 'modal', header: (props) => <ModalHeader {...props} /> }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
