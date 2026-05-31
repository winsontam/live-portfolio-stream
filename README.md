# Live Portfolio Stream

Real-time crypto portfolio and watchlist over WebSockets. Top 200 pairs quoted in USDT or USDC by volume from Binance.

## Demo

https://github.com/user-attachments/assets/215e2e20-e476-4fe7-8060-1fefc3469651

## Local run

**Prerequisites:** Docker + Docker Compose, Node 20+

```bash
# Start Redis
docker compose up -d redis

# Backend
cd backend
cp .env.example .env
npm install
npm run start:dev

# Frontend (new terminal)
cd frontend
cp .env.example .env
npm install
npm run web        # browser
npm run ios        # iOS simulator
```

## Design decisions

**Node.js** — picked Node.js because I'm familiar with NestJS and TypeScript, which made iteration faster. Chose Socket.IO because NestJS supports it natively, and it made adopting the Redis adapter straightforward — `server.to(room).emit()` handles pub/sub fanout with no extra code.

**Order book via Socket.IO rooms** — clients join a Socket.IO room (`book:BTCUSDT`) on opening the detail modal and leave on close. Order book diffs are only pushed to subscribed clients on demand.

## What I'd fix next

1. **In-memory data storage** — market data, the backfill ring buffer, and mock portfolio positions are all stored in memory. A backend restart loses the buffer (breaking backfill) and the frontend loses positions on reload. These should move to a proper store — Redis for the ring buffer, a backend DB (e.g. PostgreSQL) for portfolio positions.

2. **Portfolio positions on the backend** — positions are currently seeded and held on the client. They should be stored in a backend DB per user and returned on connect, so positions persist across devices and app restarts.

3. **Stablecoin pricing** — `totalValue` assumes USDT/USDC = $1.00. A real implementation fetches a USDT/USD rate to account for depeg risk.
