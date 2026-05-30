/**
 * watchlistStore.ts
 * AsyncStorage-backed watchlist of conditionIds.
 * Starts empty. User explicitly adds / removes markets.
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'watchlist_v1';

interface WatchlistState {
  ids: string[];          // ordered list of conditionIds
  loaded: boolean;
  load: () => Promise<void>;
  add: (conditionId: string) => Promise<void>;
  remove: (conditionId: string) => Promise<void>;
  reorder: (ids: string[]) => Promise<void>;
  has: (conditionId: string) => boolean;
}

async function persist(ids: string[]) {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Native module unavailable (Expo Go / web) — in-memory only
  }
}

export const useWatchlistStore = create<WatchlistState>((set, get) => ({
  ids: [],
  loaded: false,

  async load() {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const ids: string[] = raw ? JSON.parse(raw) : [];
      set({ ids, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },

  async add(conditionId) {
    const { ids } = get();
    if (ids.includes(conditionId)) return;
    const next = [conditionId, ...ids];
    set({ ids: next });
    await persist(next);
  },

  async remove(conditionId) {
    const next = get().ids.filter((id) => id !== conditionId);
    set({ ids: next });
    await persist(next);
  },

  async reorder(ids) {
    set({ ids });
    await persist(ids);
  },

  has(conditionId) {
    return get().ids.includes(conditionId);
  },
}));
