# CLAUDE.md

This file provides guidance when working with code in this repository.

## Overview

A real-time cryptocurrency market data app. The backend streams live Binance price/order book data to a React Native (Expo) frontend over Socket.IO.

- **Backend** (`/backend`): NestJS + Socket.IO + Socket.IO Redis adapter
- **Frontend** (`/frontend`): React Native (Expo) with Zustand state management

## Development commands

### Infrastructure

```bash
# Start Redis (required before running backend)
docker compose up -d redis
```

### Backend (`cd backend`)

```bash
npm install
npm run start:dev      # dev with watch mode
npm run start:prod     # production (runs dist/main)
npm run build          # compile TypeScript
npm run lint           # ESLint with auto-fix
```

Backend env: copy `backend/.env.example` to `backend/.env`. Required: `REDIS_URL`, `PORT`.

### Frontend (`cd frontend`)

```bash
npm install
npm run ios            # iOS simulator
npm run web            # browser
npm run lint           # ESLint
```

Frontend env: copy `frontend/.env.example` to `frontend/.env`. Required: `EXPO_PUBLIC_API_URL`.

## Architecture

### Data flow

```
Binance REST API ──► BinanceDataService (in-memory token map)
Binance WS (ticker) ─┤
Binance WS (depth)  ─┘
        │ onDiffCallback (in-process)
        ▼
MarketGateway (NestJS Socket.IO gateway at /market)
        │
        ├── Socket.IO Redis adapter (fanout across instances)
        ├── 500-entry ring buffer (timestamp-based backfill)
        ├── book:SYMBOL rooms (order book on-demand)
        │
        ▼
Frontend: marketSocket.ts → useMarketStore (Zustand) → React components
```

### Backend modules

- **`BinanceDataService`** — single source of truth. On boot: REST fetch top-200 pairs quoted in USDT or USDC by volume, opens WS A for `miniTicker` (price ticks), WS B for `depth20@100ms` (order book). Both reconnect with exponential backoff. Calls `onDiffCallback` on every update.
- **`MarketGateway`** — Socket.IO gateway. Ring buffer of 500 `TokenDiff` entries for reconnect backfill. Clients join `book:SYMBOL` rooms to receive order book diffs on demand.
- **`MarketController`** — REST fallback: `GET /markets` and `GET /markets/:productId`.
- **`RedisIoAdapter`** (`common/`) — NestJS IoAdapter using `@socket.io/redis-adapter` with ioredis.
- **`EnvModule`** — typed, validated env vars via `class-validator`. Required vars throw on boot.

### Frontend

- **`marketSocket.ts`** (`services/`) — owns the Socket.IO lifecycle. Batches diffs in 50ms window, handles stale detection (10s → force reconnect), AppState background/foreground reconciliation.
- **`useMarketStore`** (Zustand) — state only. `marketSocket.ts` pushes via `getState()`, never via hooks.
- **`useWatchlistStore`** — persisted; new items prepend to list.
- **`usePortfolioStore`** — mock positions seeded from top-6 tokens by volume on first load.
- Navigation: bottom tabs (Watchlist → Markets → Portfolio) + modal stack for `MarketDetailScreen`.
- `MarketDetailScreen` subscribes to order book on mount, unsubscribes on unmount.

### Key data contract

`TokenDiff.price === 0` is a sentinel meaning "order-book-only update — skip price fields."
`TokenDiff.updatedAt` is used for reconnect backfill (`since: lastUpdatedAt`).

### ConnectionStatus enum

```ts
enum ConnectionStatus {
  CONNECTING    = 'CONNECTING',
  CONNECTED     = 'CONNECTED',
  RECONNECTING  = 'RECONNECTING',
  STALE         = 'STALE',       // connected but no data for 10s
  DISCONNECTED  = 'DISCONNECTED',
}
```
