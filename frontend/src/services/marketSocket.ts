/**
 * MarketSocket
 *
 * Owns the WebSocket connection lifecycle and all Binance/server event handling.
 * Pushes state changes into useMarketStore — never reads from React components.
 *
 * Usage:
 *   marketSocket.connect(url)
 *   marketSocket.disconnect()
 *   marketSocket.subscribeBook(productId)
 *   marketSocket.unsubscribeBook(productId)
 */

import { io, Socket } from 'socket.io-client';
import { AppState, AppStateStatus } from 'react-native';
import { useMarketStore, ConnectionStatus } from '../store/marketStore';
import type { Token, TokenDiff } from '../types/market';

const STALE_THRESHOLD_MS = 10_000;
const BATCH_WINDOW_MS = 50;
const EMPTY_SNAPSHOT_RETRY_MS = 2_500;

let socket: Socket | null = null;
let baseUrl = '';
let staleTimer: ReturnType<typeof setTimeout> | null = null;
let batchTimer: ReturnType<typeof setTimeout> | null = null;
let emptySnapshotTimer: ReturnType<typeof setTimeout> | null = null;
let pendingDiffs: Record<string, TokenDiff> = {};
let appStateSub: ReturnType<typeof AppState.addEventListener> | null = null;

// ── helpers ────────────────────────────────────────────────────────────────

function store() {
  return useMarketStore.getState();
}

function resetStaleTimer() {
  if (staleTimer) clearTimeout(staleTimer);
  staleTimer = setTimeout(() => {
    store().setStatus(ConnectionStatus.STALE);
    // Socket still connected but feed went silent — force reconnect
    if (socket?.connected) {
      socket.disconnect();
      socket.connect();
    }
  }, STALE_THRESHOLD_MS);
}

async function fetchTokensRest() {
  try {
    const res = await fetch(`${baseUrl}/markets`);
    if (!res.ok) return;
    const tokens = await res.json() as Token[];
    if (tokens.length === 0) return;
    const map: Record<string, Token> = {};
    for (const t of tokens) map[t.productId] = t;
    store().mergeTokens(map);
  } catch {
    // network unavailable — silently ignore
  }
}

function flushDiffs() {
  const batch = pendingDiffs;
  pendingDiffs = {};
  batchTimer = null;

  const { tokens, lastUpdatedAt } = store();
  const merged = { ...tokens };
  let latestUpdatedAt = lastUpdatedAt;

  for (const [id, d] of Object.entries(batch)) {
    const existing = merged[id];
    if (!existing) continue;

    const isPriceUpdate = d.price > 0;
    merged[id] = {
      ...existing,
      ...(isPriceUpdate ? {
        price: d.price,
        priceChange24h: d.priceChange24h,
        high24h: d.high24h || existing.high24h,
        low24h: d.low24h || existing.low24h,
        volume24h: d.volume24h || existing.volume24h,
      } : {}),
      ...(d.bestBid > 0 ? { bestBid: d.bestBid } : {}),
      ...(d.bestAsk > 0 ? { bestAsk: d.bestAsk } : {}),
      ...(d.spread > 0 ? { spread: d.spread } : {}),
      ...(d.orderBook ? { orderBook: d.orderBook } : {}),
    };

    if (d.updatedAt > latestUpdatedAt) latestUpdatedAt = d.updatedAt;
  }

  store().applyDiff(merged, latestUpdatedAt);
  resetStaleTimer();
}

// ── public API ─────────────────────────────────────────────────────────────

export const marketSocket = {
  connect(url: string) {
    if (socket) return;
    baseUrl = url;
    store().setStatus(ConnectionStatus.CONNECTING);

    socket = io(`${url}/market`, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 8000,
    });

    socket.on('market:snapshot', (data: { tokens: Token[] }) => {
      if (emptySnapshotTimer) { clearTimeout(emptySnapshotTimer); emptySnapshotTimer = null; }

      if (data.tokens.length === 0) {
        store().setStatus(ConnectionStatus.CONNECTED);
        store().setLastTickAt(Date.now());
        emptySnapshotTimer = setTimeout(() => {
          void fetchTokensRest().then(() => {
            if (Object.keys(store().tokens).length === 0) {
              emptySnapshotTimer = setTimeout(() => void fetchTokensRest(), EMPTY_SNAPSHOT_RETRY_MS);
            }
          });
        }, EMPTY_SNAPSHOT_RETRY_MS);
      } else {
        const map: Record<string, Token> = {};
        for (const t of data.tokens) map[t.productId] = t;
        store().setTokens(map);
        store().setStatus(ConnectionStatus.CONNECTED);
        store().setLastTickAt(Date.now());
      }
      resetStaleTimer();
    });

    socket.on('market:update', (diff: TokenDiff) => {
      if (Object.keys(store().tokens).length === 0 && !emptySnapshotTimer) {
        emptySnapshotTimer = setTimeout(() => {
          void fetchTokensRest();
          emptySnapshotTimer = null;
        }, 500);
      }

      pendingDiffs[diff.productId] = diff;
      if (!batchTimer) batchTimer = setTimeout(flushDiffs, BATCH_WINDOW_MS);
    });

    socket.on('connect', () => {
      store().setStatus(ConnectionStatus.CONNECTED);
      const { lastUpdatedAt } = store();
      if (lastUpdatedAt > 0) socket?.emit('market:reconnect', { since: lastUpdatedAt });
      resetStaleTimer();
    });

    socket.on('disconnect', () => {
      store().setStatus(ConnectionStatus.DISCONNECTED);
      if (staleTimer) clearTimeout(staleTimer);
    });

    socket.io.on('reconnect_attempt', () => store().setStatus(ConnectionStatus.RECONNECTING));
    socket.io.on('reconnect', () => store().setStatus(ConnectionStatus.CONNECTED));

    // ── AppState: background → foreground ──────────────────────────────
    let backgroundedAt = 0;
    appStateSub = AppState.addEventListener('change', (s: AppStateStatus) => {
      if (s === 'background') {
        backgroundedAt = Date.now();
      } else if (s === 'active' && backgroundedAt > 0) {
        const elapsed = Date.now() - backgroundedAt;
        backgroundedAt = 0;
        if (elapsed > 5_000 && socket?.connected) {
          socket.emit('market:reconnect', { since: store().lastUpdatedAt });
        }
      }
    });
  },

  disconnect() {
    socket?.disconnect();
    socket = null;
    appStateSub?.remove();
    appStateSub = null;
    if (staleTimer) clearTimeout(staleTimer);
    if (batchTimer) clearTimeout(batchTimer);
    if (emptySnapshotTimer) clearTimeout(emptySnapshotTimer);
    pendingDiffs = {};
    store().setStatus(ConnectionStatus.DISCONNECTED);
  },

  subscribeBook(productId: string) {
    socket?.emit('market:subscribe-book', { productId });
  },

  unsubscribeBook(productId: string) {
    socket?.emit('market:unsubscribe-book', { productId });
  },
};
