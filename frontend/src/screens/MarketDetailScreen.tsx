import React, {useEffect} from 'react';
import {ScrollView, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {useRoute} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useMarketStore} from '../store/marketStore';
import {useWatchlistStore} from '../store/watchlistStore';
import {marketSocket} from '../services/marketSocket';
import {AnimatedPrice} from '../components/AnimatedPrice';
import type {RootStackParamList} from '../navigation/types';
import type {OrderBookLevel} from '../types/market';

type Route = NativeStackScreenProps<RootStackParamList, 'MarketDetail'>['route'];

const usd = (v: number) =>
  v >= 1_000_000_000
    ? `$${(v / 1_000_000_000).toFixed(2)}B`
    : v >= 1_000_000
    ? `$${(v / 1_000_000).toFixed(2)}M`
    : v >= 1_000
    ? `$${(v / 1_000).toFixed(1)}K`
    : `$${v.toFixed(2)}`;

const fmt = (v: number) =>
  v === 0 ? '—' : v >= 1000 ? v.toLocaleString('en-US', { maximumFractionDigits: 2 }) : v.toPrecision(6).replace(/\.?0+$/, '');

export function MarketDetailScreen() {
  const route = useRoute<Route>();
  const { productId } = route.params;
  const token = useMarketStore((s) => s.tokens[productId]);
  useEffect(() => {
    marketSocket.subscribeBook(productId);
    return () => marketSocket.unsubscribeBook(productId);
  }, [productId]);
  const { has, add, remove } = useWatchlistStore();
  const inWatchlist = has(productId);

  if (!token) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Token not found</Text>
      </View>
    );
  }

  const changeColor = token.priceChange24h >= 0 ? '#22c55e' : '#ef4444';
  const bids = token.orderBook?.bids ?? [];
  const asks = token.orderBook?.asks ?? [];
  const maxSize = Math.max(
    ...bids.map((b) => b.size),
    ...asks.map((a) => a.size),
    1,
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Name + price strip */}
      <View style={styles.nameRow}>
        <Text style={styles.displayName}>{token.baseCurrency} / {token.quoteCurrency}</Text>
        <TouchableOpacity
          onPress={() => (inWatchlist ? remove(productId) : add(productId))}
          style={styles.watchBtn}
        >
          <Text style={[styles.watchBtnIcon, inWatchlist && styles.watchBtnActive]}>
            {inWatchlist ? '★' : '☆'}
          </Text>
        </TouchableOpacity>
      </View>
      <View style={styles.priceStrip}>
        <View style={styles.priceBlock}>
          <Text style={styles.priceLabel}>Price</Text>
          <AnimatedPrice
            value={token.price}
            format={(v) => `$${fmt(v)}`}
            style={styles.bigPriceWrap}
          />
        </View>
        <View style={styles.priceBlock}>
          <Text style={styles.priceLabel}>24h Change</Text>
          <Text style={[styles.bigChange, { color: changeColor }]}>
            {token.priceChange24h >= 0 ? '+' : ''}{token.priceChange24h.toFixed(2)}%
          </Text>
        </View>
      </View>

      {/* 24h stats */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>24h Stats</Text>
        <View style={styles.statsRow}>
          <StatBlock label="High" value={`$${fmt(token.high24h)}`} />
          <StatBlock label="Low" value={`$${fmt(token.low24h)}`} />
          <StatBlock label="Volume" value={usd(token.volume24h * token.price)} />
        </View>
      </View>

      {/* Order book */}
      <View style={styles.section}>
        <View style={styles.bookHeader}>
          <Text style={[styles.bookSideLabel, { color: '#22c55e' }]}>BIDS</Text>
          <Text style={styles.sectionTitle}>Order Book</Text>
          <Text style={[styles.bookSideLabel, { color: '#ef4444' }]}>ASKS</Text>
        </View>

        {/* Spread row */}
        <View style={styles.spreadRow}>
          <Text style={styles.spreadLabel}>Spread</Text>
          <Text style={styles.spreadValue}>
            ${token.spread > 0 ? token.spread.toFixed(token.price > 100 ? 2 : 4) : '—'}
            {token.bestAsk > 0 && token.spread > 0
              ? `  (${((token.spread / token.bestAsk) * 100).toFixed(3)}%)`
              : ''}
          </Text>
        </View>

        {/* Book levels — bids left, asks right */}
        <View style={styles.bookColumns}>
          {/* Bids */}
          <View style={styles.bookCol}>
            <View style={styles.bookColHeader}>
              <Text style={styles.bookColHeadText}>Size</Text>
              <Text style={styles.bookColHeadText}>Price</Text>
            </View>
            {bids.length === 0
              ? <Text style={styles.noBook}>No data</Text>
              : bids.map((level, i) => (
                <BookRow key={i} level={level} side="bid" maxSize={maxSize} />
              ))}
          </View>

          <View style={styles.bookDivider} />

          {/* Asks */}
          <View style={styles.bookCol}>
            <View style={styles.bookColHeader}>
              <Text style={styles.bookColHeadText}>Price</Text>
              <Text style={styles.bookColHeadText}>Size</Text>
            </View>
            {asks.length === 0
              ? <Text style={styles.noBook}>No data</Text>
              : asks.map((level, i) => (
                <BookRow key={i} level={level} side="ask" maxSize={maxSize} />
              ))}
          </View>
        </View>
      </View>

      {/* Market info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Info</Text>
        <StatRow label="Pair" value={`${token.baseCurrency} / ${token.quoteCurrency}`} />
        <StatRow label="Best Bid" value={`$${fmt(token.bestBid)}`} />
        <StatRow label="Best Ask" value={`$${fmt(token.bestAsk)}`} />
        <StatRow label="Status" value={token.status} />
        <StatRow
          label="Last Updated"
          value={token.cachedAt ? new Date(token.cachedAt).toLocaleTimeString() : '—'}
        />
      </View>
    </ScrollView>
  );
}

function BookRow({ level, side, maxSize }: { level: OrderBookLevel; side: 'bid' | 'ask'; maxSize: number }) {
  const isBid = side === 'bid';
  const fillPct = Math.min((level.size / maxSize) * 100, 100);
  const fillColor = isBid ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)';
  const priceColor = isBid ? '#22c55e' : '#ef4444';

  return (
    <View style={styles.bookRow}>
      {/* depth bar */}
      <View
        style={[
          styles.depthBar,
          {
            width: `${fillPct}%` as unknown as number,
            backgroundColor: fillColor,
            [isBid ? 'right' : 'left']: 0,
          },
        ]}
      />
      {isBid ? (
        <>
          <Text style={styles.bookSize}>{level.size.toFixed(4)}</Text>
          <Text style={[styles.bookPrice, { color: priceColor }]}>{fmt(level.price)}</Text>
        </>
      ) : (
        <>
          <Text style={[styles.bookPrice, { color: priceColor }]}>{fmt(level.price)}</Text>
          <Text style={styles.bookSize}>{level.size.toFixed(4)}</Text>
        </>
      )}
    </View>
  );
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statBlock}>
      <Text style={styles.statBlockLabel}>{label}</Text>
      <Text style={styles.statBlockValue}>{value}</Text>
    </View>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a' },
  muted: { color: '#64748b', fontSize: 14 },

  displayName: { fontSize: 20, color: '#f1f5f9', fontWeight: '700' },

  priceStrip: { flexDirection: 'row', gap: 24, marginBottom: 8 },
  priceBlock: {},
  priceLabel: { fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  bigPriceWrap: { alignItems: 'flex-start' },
  bigChange: { fontSize: 24, fontWeight: '800', fontVariant: ['tabular-nums'] },

  section: {
    marginTop: 20,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
  },
  sectionTitle: {
    fontSize: 11, color: '#64748b', textTransform: 'uppercase',
    letterSpacing: 0.5, fontWeight: '600', textAlign: 'center', marginBottom: 10,
  },

  statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  statBlock: { alignItems: 'center' },
  statBlockLabel: { fontSize: 11, color: '#64748b', marginBottom: 4 },
  statBlockValue: { fontSize: 14, color: '#e2e8f0', fontWeight: '700', fontVariant: ['tabular-nums'] },

  // order book
  bookHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  bookSideLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  spreadRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginBottom: 8 },
  spreadLabel: { fontSize: 11, color: '#64748b' },
  spreadValue: { fontSize: 11, color: '#94a3b8', fontVariant: ['tabular-nums'] },

  bookColumns: { flexDirection: 'row' },
  bookCol: { flex: 1 },
  bookDivider: { width: 1, backgroundColor: '#334155', marginHorizontal: 8 },
  bookColHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, marginBottom: 4 },
  bookColHeadText: { fontSize: 10, color: '#475569', textTransform: 'uppercase' },

  bookRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingVertical: 3,
    position: 'relative',
    overflow: 'hidden',
  },
  depthBar: {
    position: 'absolute',
    top: 0,
    bottom: 0,
  },
  bookPrice: { fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] },
  bookSize: { fontSize: 12, color: '#94a3b8', fontVariant: ['tabular-nums'] },
  noBook: { fontSize: 12, color: '#475569', textAlign: 'center', padding: 12 },

  statRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 7, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#334155',
  },
  statLabel: { fontSize: 13, color: '#94a3b8' },
  statValue: { fontSize: 13, color: '#e2e8f0', fontWeight: '600', fontVariant: ['tabular-nums'] },

  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  watchBtn: { padding: 4 },
  watchBtnIcon: { fontSize: 22, color: '#94a3b8' },
  watchBtnActive: { color: '#f59e0b' },
});
