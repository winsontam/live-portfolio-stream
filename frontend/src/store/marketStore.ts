import { create } from 'zustand';
import type { Token } from '../types/market';

export enum ConnectionStatus {
  CONNECTING    = 'CONNECTING',
  CONNECTED     = 'CONNECTED',
  RECONNECTING  = 'RECONNECTING',
  STALE         = 'STALE',
  DISCONNECTED  = 'DISCONNECTED',
}

export interface MarketState {
  tokens: Record<string, Token>;
  lastUpdatedAt: number;           // timestamp of last received update (ms)
  connectionStatus: ConnectionStatus;
  lastTickAt: number;

  // state mutations — called by marketSocket, not components
  setTokens: (tokens: Record<string, Token>) => void;
  mergeTokens: (tokens: Record<string, Token>) => void;
  setStatus: (status: ConnectionStatus) => void;
  setLastTickAt: (ts: number) => void;
  applyDiff: (merged: Record<string, Token>, updatedAt: number) => void;
}

export const useMarketStore = create<MarketState>((set) => ({
  tokens: {},
  lastUpdatedAt: 0,
  connectionStatus: ConnectionStatus.DISCONNECTED,
  lastTickAt: 0,

  setTokens: (tokens) => set({ tokens }),

  mergeTokens: (incoming) =>
    set((state) => ({ tokens: { ...incoming, ...state.tokens } })),

  setStatus: (connectionStatus) => set({ connectionStatus }),

  setLastTickAt: (lastTickAt) => set({ lastTickAt }),

  applyDiff: (merged, updatedAt) =>
    set((state) => ({
      tokens: merged,
      lastUpdatedAt: Math.max(state.lastUpdatedAt, updatedAt),
      lastTickAt: Date.now(),
      connectionStatus: ConnectionStatus.CONNECTED,
    })),
}));
