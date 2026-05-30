import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TextInput, TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMarketStore } from '../store/marketStore';
import { useWatchlistStore } from '../store/watchlistStore';
import { AnimatedPrice } from '../components/AnimatedPrice';
import type { Token } from '../types/market';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const pct = (v: number) => {
  const sign = v >= 0 ? '+' : '';
  return `${sign}${v.toFixed(2)}%`;
};

interface RowProps {
  token: Token;
  inWatchlist: boolean;
  onToggle: (id: string) => void;
  onPress: (id: string) => void;
}

const TokenItem = React.memo(({ token, inWatchlist, onToggle, onPress }: RowProps) => {
  const changeColor = token.priceChange24h >= 0 ? '#22c55e' : '#ef4444';
  return (
    <TouchableOpacity style={styles.row} onPress={() => onPress(token.productId)} activeOpacity={0.7}>
      <TouchableOpacity
        style={styles.starBtn}
        onPress={() => onToggle(token.productId)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Text style={[styles.starIcon, inWatchlist && styles.starActive]}>
          {inWatchlist ? '★' : '☆'}
        </Text>
      </TouchableOpacity>
      <View style={styles.rowLeft}>
        <View style={styles.symbolRow}>
          <Text style={styles.symbol}>{token.baseCurrency}</Text>
          <Text style={styles.quote}>/{token.quoteCurrency}</Text>
        </View>
        <Text style={styles.name} numberOfLines={1}>{token.displayName}</Text>
      </View>
      <View style={styles.rowRight}>
        <AnimatedPrice value={token.price} />
        <Text style={[styles.change, { color: changeColor }]}>{pct(token.priceChange24h)}</Text>
      </View>
    </TouchableOpacity>
  );
});

export function MarketsScreen() {
  const navigation = useNavigation<Nav>();
  const tokens = useMarketStore((s) => s.tokens);
  const { add, remove, has } = useWatchlistStore();
  const [query, setQuery] = useState('');

  const sorted = useMemo(() => {
    const all = Object.values(tokens)
      .filter((t) => t.status === 'online')
      .sort((a, b) => b.volume24h - a.volume24h);
    if (!query.trim()) return all;
    const q = query.toLowerCase();
    return all.filter(
      (t) =>
        t.baseCurrency.toLowerCase().includes(q) ||
        t.displayName.toLowerCase().includes(q) ||
        t.productId.toLowerCase().includes(q),
    );
  }, [tokens, query]);

  const handleToggle = useCallback(
    (id: string) => { if (has(id)) { void remove(id); } else { void add(id); } },
    [add, remove, has],
  );
  const handlePress = useCallback(
    (id: string) => { navigation.navigate('MarketDetail', { productId: id }); },
    [navigation],
  );

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.search}
        placeholder="Search tokens…"
        placeholderTextColor="#475569"
        value={query}
        onChangeText={setQuery}
        clearButtonMode="always"
      />
      <FlatList
        data={sorted}
        keyExtractor={(t) => t.productId}
        renderItem={({ item }) => (
          <TokenItem
            token={item}
            inWatchlist={has(item.productId)}
            onToggle={handleToggle}
            onPress={handlePress}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              {Object.keys(tokens).length === 0 ? 'Connecting to feed…' : 'No tokens match.'}
            </Text>
          </View>
        }
        initialNumToRender={25}
        maxToRenderPerBatch={25}
        windowSize={5}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  search: {
    margin: 12,
    backgroundColor: '#1e293b',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#e2e8f0',
    fontSize: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1e293b',
  },
  starBtn: { marginRight: 10, padding: 2 },
  starIcon: { fontSize: 20, color: '#475569' },
  starActive: { color: '#f59e0b' },
  rowLeft: { flex: 1, paddingRight: 8 },
  symbolRow: { flexDirection: 'row', alignItems: 'baseline' },
  symbol: { fontSize: 14, color: '#f1f5f9', fontWeight: '700' },
  quote: { fontSize: 11, color: '#475569', marginLeft: 2, fontWeight: '500' },
  name: { fontSize: 11, color: '#64748b', marginTop: 2 },
  rowRight: { alignItems: 'flex-end', minWidth: 80 },
  change: { fontSize: 11, marginTop: 2, fontWeight: '600' },
  empty: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#64748b', fontSize: 14 },
});
