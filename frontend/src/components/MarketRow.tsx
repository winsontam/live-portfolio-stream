import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { AnimatedPrice } from './AnimatedPrice';
import type { Token } from '../types/market';

interface Props {
  token: Token;
  onPress?: () => void;
}

const pct = (v: number) => {
  const sign = v >= 0 ? '+' : '';
  return `${sign}${v.toFixed(2)}%`;
};

export const MarketRow = memo(({ token, onPress }: Props) => {
  const changeColor = token.priceChange24h >= 0 ? '#22c55e' : '#ef4444';
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.left}>
        <View style={styles.symbolRow}>
          <Text style={styles.symbol}>{token.baseCurrency}</Text>
          <Text style={styles.quote}>/{token.quoteCurrency}</Text>
        </View>
        <Text style={styles.name} numberOfLines={1}>{token.displayName}</Text>
      </View>
      <View style={styles.right}>
        <AnimatedPrice value={token.price} />
        <Text style={[styles.change, { color: changeColor }]}>{pct(token.priceChange24h)}</Text>
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1e293b',
  },
  left: { flex: 1, paddingRight: 8 },
  symbolRow: { flexDirection: 'row', alignItems: 'baseline' },
  symbol: { fontSize: 14, color: '#f1f5f9', fontWeight: '700' },
  quote: { fontSize: 11, color: '#475569', marginLeft: 2, fontWeight: '500' },
  name: { fontSize: 11, color: '#64748b', marginTop: 2 },
  right: { alignItems: 'flex-end', minWidth: 80 },
  change: { fontSize: 11, marginTop: 2, fontWeight: '600' },
});
