import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useMarketStore } from '../store/marketStore';
import { useWatchlistStore } from '../store/watchlistStore';
import { MarketRow } from '../components/MarketRow';
import type { RootStackParamList, TabParamList } from '../navigation/types';
import type { Token } from '../types/market';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type TabNav = BottomTabNavigationProp<TabParamList>;

export function WatchlistScreen() {
  const navigation = useNavigation<Nav>();
  const tabNavigation = useNavigation<TabNav>();
  const tokens = useMarketStore((s) => s.tokens);
  const { ids, remove, reorder } = useWatchlistStore();
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleMove = useCallback((index: number, dir: -1 | 1) => {
    const next = [...ids];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    void reorder(next);
  }, [ids, reorder]);

  const watchlistTokens = ids.map((id) => tokens[id]).filter(Boolean) as Token[];

  const handlePress = useCallback((productId: string) => {
    if (editingId) { setEditingId(null); return; }
    navigation.navigate('MarketDetail', { productId });
  }, [navigation, editingId]);


  if (ids.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.starBig}>☆</Text>
        <Text style={styles.emptyTitle}>Your watchlist is empty</Text>
        <Text style={styles.emptySubtitle}>
          Go to Markets and tap the <Text style={styles.starInline}>☆</Text> next to any token to add it here.
        </Text>
        <TouchableOpacity style={styles.goBtn} onPress={() => tabNavigation.navigate('Markets')}>
          <Text style={styles.goBtnText}>Browse Markets</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={watchlistTokens}
        keyExtractor={(t) => t.productId}
        renderItem={({ item, index }) => {
          const isEditing = editingId === item.productId;
          return (
            <View style={styles.row}>
              {isEditing && (
                <View style={styles.controls}>
                  <TouchableOpacity
                    style={styles.ctrlBtn}
                    onPress={() => handleMove(index, -1)}
                    disabled={index === 0}
                  >
                    <Text style={[styles.ctrlText, index === 0 && styles.ctrlDisabled]}>↑</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.ctrlBtn}
                    onPress={() => handleMove(index, 1)}
                    disabled={index === watchlistTokens.length - 1}
                  >
                    <Text style={[styles.ctrlText, index === watchlistTokens.length - 1 && styles.ctrlDisabled]}>↓</Text>
                  </TouchableOpacity>
                </View>
              )}
              <View style={styles.rowContent}>
                <MarketRow token={item} onPress={() => handlePress(item.productId)} />
              </View>
              {isEditing && (
                <TouchableOpacity style={styles.ctrlBtn} onPress={() => remove(item.productId)}>
                  <Text style={styles.deleteText}>✕</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.ctrlBtn}
                onPress={() => setEditingId(isEditing ? null : item.productId)}
              >
                <Text style={[styles.ctrlText, !isEditing && styles.editIcon, isEditing && styles.doneText]}>
                  {isEditing ? '✓' : '✎'}
                </Text>
              </TouchableOpacity>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyInline}>
            <Text style={styles.emptySubtitle}>Loading token data…</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },

  row: { flexDirection: 'row', alignItems: 'center' },
  rowContent: { flex: 1 },
  controls: { flexDirection: 'row', alignItems: 'center', paddingRight: 4 },
  ctrlBtn: { padding: 8 },
  ctrlText: { fontSize: 15, color: '#64748b', fontWeight: '600' },
  ctrlDisabled: { color: '#1e293b' },
  editIcon: { transform: [{ scaleX: -1 }] },
  deleteText: { fontSize: 14, color: '#ef4444', fontWeight: '700' },
  doneText: { fontSize: 16, color: '#22c55e', fontWeight: '700' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32, backgroundColor: '#0f172a' },
  emptyInline: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  starBig: { fontSize: 48, color: '#334155' },
  emptyTitle: { fontSize: 20, color: '#e2e8f0', fontWeight: '700' },
  emptySubtitle: { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 22 },
  starInline: { fontSize: 14, color: '#f59e0b' },
  goBtn: {
    marginTop: 8,
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 11,
  },
  goBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
