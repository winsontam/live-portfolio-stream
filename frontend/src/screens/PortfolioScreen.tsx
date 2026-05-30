import React, { useEffect } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { useMarketStore } from '../store/marketStore';
import { usePortfolioStore, type Position } from '../store/portfolioStore';
import { AnimatedPrice } from '../components/AnimatedPrice';

const MOCK_QTY = [0.5, 1, 2, 5, 0.1, 10];
const COST_OFFSET = 0.02; // avgCost = price ± 2%

function seedPositions(tokens: ReturnType<typeof useMarketStore.getState>['tokens']): Position[] {
  return Object.values(tokens)
    .filter((t) => t.status === 'online' && t.price > 0)
    .sort((a, b) => b.volume24h - a.volume24h)
    .slice(0, 6)
    .map((t, i) => ({
      productId: t.productId,
      qty: MOCK_QTY[i % MOCK_QTY.length],
      avgCost: t.price * (1 - COST_OFFSET + Math.random() * COST_OFFSET * 2),
    }));
}

export function PortfolioScreen() {
  const tokens = useMarketStore((s) => s.tokens);
  const { positions, setPositions } = usePortfolioStore();

  useEffect(() => {
    if (positions.length === 0 && Object.keys(tokens).length > 0) {
      setPositions(seedPositions(tokens));
    }
  }, [tokens, positions.length, setPositions]);

  const rows = positions.map((pos) => {
    const token = tokens[pos.productId];
    const price = token?.price ?? 0;
    const pnl = (price - pos.avgCost) * pos.qty;
    const pnlPct = pos.avgCost > 0 ? ((price - pos.avgCost) / pos.avgCost) * 100 : 0;
    return { pos, token, price, pnl, pnlPct };
  });

  const totalValue = rows.reduce((sum, r) => sum + r.price * r.pos.qty, 0);
  const totalPnl = rows.reduce((sum, r) => sum + r.pnl, 0);

  const fmtPrice = (v: number) =>
    v >= 1000
      ? v.toLocaleString('en-US', { maximumFractionDigits: 2 })
      : v.toPrecision(5).replace(/\.?0+$/, '');

  return (
    <View style={styles.container}>
      <View style={styles.summary}>
        <View style={styles.summaryBlock}>
          <Text style={styles.summaryLabel}>Portfolio Value</Text>
          <Text style={styles.summaryValue}>
            ${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
        </View>
        <View style={styles.summaryBlock}>
          <Text style={styles.summaryLabel}>Unrealized P&L</Text>
          <Text style={[styles.summaryValue, { color: totalPnl >= 0 ? '#22c55e' : '#ef4444' }]}>
            {totalPnl >= 0 ? '+' : ''}${Math.abs(totalPnl).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
        </View>
      </View>

      <FlatList
        data={rows}
        keyExtractor={(r) => r.pos.productId}
        renderItem={({ item: { pos, token, price, pnl, pnlPct } }) => (
          <View style={styles.row}>
            <View style={styles.rowTop}>
              <View>
                <Text style={styles.symbol}>{token?.baseCurrency ?? pos.productId}</Text>
                <Text style={styles.name}>{token?.displayName ?? ''}</Text>
              </View>
              <View style={styles.rowPnl}>
                <Text style={[styles.pnlValue, { color: pnl >= 0 ? '#22c55e' : '#ef4444' }]}>
                  {pnl >= 0 ? '+' : '-'}${Math.abs(pnl).toFixed(2)}
                </Text>
                <Text style={[styles.pnlPct, { color: pnl >= 0 ? '#22c55e' : '#ef4444' }]}>
                  ({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%)
                </Text>
              </View>
            </View>
            <View style={styles.rowBottom}>
              <Text style={styles.meta}>
                Qty {pos.qty} · Avg ${fmtPrice(pos.avgCost)}
              </Text>
              <View style={styles.lastWrap}>
                <Text style={styles.metaLabel}>Last  </Text>
                <AnimatedPrice value={price} format={(v) => `$${fmtPrice(v)}`} />
              </View>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              {Object.keys(tokens).length === 0 ? 'Connecting to feed…' : 'No positions'}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  summary: {
    flexDirection: 'row', backgroundColor: '#1e293b',
    paddingVertical: 16, paddingHorizontal: 20, gap: 32,
  },
  summaryBlock: {},
  summaryLabel: { fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  summaryValue: { fontSize: 22, fontWeight: '800', color: '#f1f5f9', fontVariant: ['tabular-nums'] },

  row: {
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#1e293b',
  },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  symbol: { fontSize: 15, color: '#f1f5f9', fontWeight: '700' },
  name: { fontSize: 11, color: '#64748b', marginTop: 2 },
  rowPnl: { alignItems: 'flex-end' },
  pnlValue: { fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  pnlPct: { fontSize: 11, fontVariant: ['tabular-nums'] },
  rowBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  meta: { fontSize: 11, color: '#64748b', fontVariant: ['tabular-nums'] },
  lastWrap: { flexDirection: 'row', alignItems: 'center' },
  metaLabel: { fontSize: 11, color: '#64748b' },
  empty: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#64748b', fontSize: 14 },
});
