/**
 * BinanceDataService
 *
 * Single source of truth for all market data. Uses public Binance APIs only.
 *
 * Boot sequence:
 *   1. REST GET /ticker/24hr  → initial prices + 24h stats for all USDT pairs
 *   2. WS connection A: {symbol}@miniTicker streams for all tokens → live price ticks
 *   3. WS connection B: {symbol}@depth20@100ms for top-N by volume → live order book
 *
 * Both WS connections reconnect automatically with exponential backoff.
 */
import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import WebSocket from 'ws';
import {
  BINANCE_REST_BASE,
  BINANCE_WS_BASE,
  ORDER_BOOK_DEPTH,
  WS_RECONNECT_DELAY_MS,
  WS_MAX_RECONNECT_DELAY_MS,
  STABLECOIN_QUOTE_CURRENCIES,
} from './binance.constants';
import type { Token, TokenDiff, OrderBook, OrderBookLevel } from './binance.types';

// ── REST types ────────────────────────────────────────────────────────────────

interface Binance24hrTicker {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  highPrice: string;
  lowPrice: string;
  volume: string; // base volume
  quoteVolume: string; // quote volume (USD equivalent)
  bidPrice: string;
  askPrice: string;
  openPrice: string;
}

// ── WS message types ──────────────────────────────────────────────────────────

interface MiniTickerData {
  e: '24hrMiniTicker';
  s: string; // symbol e.g. BTCUSDT
  c: string; // close price
  o: string; // open price
  h: string; // high
  l: string; // low
  v: string; // base volume
  q: string; // quote volume
}

interface DepthData {
  lastUpdateId: number;
  bids: [string, string][];
  asks: [string, string][];
}

interface CombinedMsg {
  stream: string;
  data: MiniTickerData | DepthData;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseBase(symbol: string, quote: string): string {
  return symbol.slice(0, symbol.length - quote.length);
}

function parseLevels(raw: [string, string][]): OrderBookLevel[] {
  return raw
    .map(([p, s]) => ({ price: parseFloat(p), size: parseFloat(s) }))
    .filter((l) => l.size > 0)
    .slice(0, ORDER_BOOK_DEPTH);
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class BinanceDataService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(BinanceDataService.name);

  private readonly tokens = new Map<string, Token>();
  private depthSymbols: string[] = [];

  private tickerWs: WebSocket | null = null;
  private depthWs: WebSocket | null = null;
  private tickerReconnectDelay = WS_RECONNECT_DELAY_MS;
  private depthReconnectDelay = WS_RECONNECT_DELAY_MS;
  private tickerReconnectTimer: NodeJS.Timeout | null = null;
  private depthReconnectTimer: NodeJS.Timeout | null = null;
  private isShuttingDown = false;

  private onDiffCallback: ((diff: TokenDiff) => void) | null = null;

  constructor(private readonly httpService: HttpService) {}

  setOnDiff(cb: (diff: TokenDiff) => void): void {
    this.onDiffCallback = cb;
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.fetchInitialData();
    this.connectTicker();
    this.connectDepth();
  }

  onApplicationShutdown(): void {
    this.isShuttingDown = true;
    this.cleanupWs(this.tickerWs);
    this.cleanupWs(this.depthWs);
    this.tickerWs = null;
    this.depthWs = null;
    if (this.tickerReconnectTimer) clearTimeout(this.tickerReconnectTimer);
    if (this.depthReconnectTimer) clearTimeout(this.depthReconnectTimer);
  }

  getAllTokens(): Token[] {
    return Array.from(this.tokens.values());
  }
  getToken(productId: string): Token | undefined {
    return this.tokens.get(productId);
  }

  // ── REST ───────────────────────────────────────────────────────────────────

  private async fetchInitialData(): Promise<void> {
    try {
      this.logger.log('Fetching Binance 24hr ticker data…');
      const { data: tickers } = await firstValueFrom(this.httpService.get<Binance24hrTicker[]>(`${BINANCE_REST_BASE}/ticker/24hr`));

      // Keep only USDT and USDC pairs, sort by quote volume, take top 200
      const top200 = tickers
        .filter((t) => STABLECOIN_QUOTE_CURRENCIES.some((q) => t.symbol.endsWith(q)) && parseFloat(t.quoteVolume) > 0)
        .sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
        .slice(0, 200);

      for (const t of top200) {
        const quote = STABLECOIN_QUOTE_CURRENCIES.find((q) => t.symbol.endsWith(q)) ?? 'USDT';
        const base = parseBase(t.symbol, quote);
        const price = parseFloat(t.lastPrice) || 0;
        const bid = parseFloat(t.bidPrice) || 0;
        const ask = parseFloat(t.askPrice) || 0;
        this.tokens.set(t.symbol, {
          productId: t.symbol,
          baseCurrency: base,
          quoteCurrency: quote,
          displayName: base,
          price,
          priceChange24h: parseFloat(t.priceChangePercent) || 0,
          high24h: parseFloat(t.highPrice) || 0,
          low24h: parseFloat(t.lowPrice) || 0,
          bestBid: bid,
          bestAsk: ask,
          spread: ask > 0 && bid > 0 ? ask - bid : 0,
          volume24h: parseFloat(t.quoteVolume) || 0, // USD quote volume for consistent sorting
          orderBook: { bids: [], asks: [] },
          status: 'online',
          cachedAt: Date.now(),
        });
      }

      // All top200 get depth stream (200 streams well within 1024 limit)
      this.depthSymbols = top200.map((t) => t.symbol.toLowerCase());
      this.logger.log(`Loaded ${this.tokens.size} tokens`);
    } catch (err: unknown) {
      this.logger.error('Failed to fetch initial data', err instanceof Error ? err.message : String(err));
    }
  }

  // ── WS A: mini ticker (all tokens) ────────────────────────────────────────

  private connectTicker(): void {
    if (this.isShuttingDown || this.tokens.size === 0) return;

    const streams = [...this.tokens.keys()].map((s) => `${s.toLowerCase()}@miniTicker`).join('/');

    this.logger.log(`Connecting ticker WS (${this.tokens.size} streams)…`);
    this.tickerWs = this.openWs(
      `${BINANCE_WS_BASE}?streams=${streams}`,
      (raw) => this.onTickerMessage(raw),
      () => {
        this.tickerReconnectDelay = WS_RECONNECT_DELAY_MS;
      },
      (code, reason) => {
        this.logger.warn(`Ticker WS closed [${code}] ${reason.toString()}`);
        if (!this.isShuttingDown) {
          this.tickerReconnectTimer = setTimeout(() => {
            this.tickerReconnectDelay = Math.min(this.tickerReconnectDelay * 2, WS_MAX_RECONNECT_DELAY_MS);
            this.connectTicker();
          }, this.tickerReconnectDelay);
        }
      },
    );
  }

  private onTickerMessage(raw: WebSocket.RawData): void {
    let msg: CombinedMsg;
    try {
      msg = JSON.parse((raw as Buffer).toString('utf8')) as CombinedMsg;
    } catch {
      return;
    }

    const d = msg.data as MiniTickerData;
    if (d.e !== '24hrMiniTicker') return;

    const token = this.tokens.get(d.s);
    if (!token) return;

    const price = parseFloat(d.c) || token.price;
    const open = parseFloat(d.o) || price;

    token.price = price;
    token.priceChange24h = open > 0 ? ((price - open) / open) * 100 : token.priceChange24h;
    token.high24h = parseFloat(d.h) || token.high24h;
    token.low24h = parseFloat(d.l) || token.low24h;
    token.volume24h = parseFloat(d.q) || token.volume24h; // d.q = quote volume (USD), d.v = base volume
    token.cachedAt = Date.now();

    const diff: Omit<TokenDiff, 'seq'> = {
      productId: token.productId,
      price: token.price,
      priceChange24h: token.priceChange24h,
      high24h: token.high24h,
      low24h: token.low24h,
      bestBid: token.bestBid,
      bestAsk: token.bestAsk,
      spread: token.spread,
      volume24h: token.volume24h,
      updatedAt: token.cachedAt,
    };

    this.onDiffCallback?.(diff);
  }

  // ── WS B: depth20 (top N) ─────────────────────────────────────────────────

  private connectDepth(): void {
    if (this.isShuttingDown || this.depthSymbols.length === 0) return;

    const streams = this.depthSymbols.map((s) => `${s}@depth20@100ms`).join('/');

    this.logger.log(`Connecting depth WS (${this.depthSymbols.length} symbols)…`);
    this.depthWs = this.openWs(
      `${BINANCE_WS_BASE}?streams=${streams}`,
      (raw) => this.onDepthMessage(raw),
      () => {
        this.depthReconnectDelay = WS_RECONNECT_DELAY_MS;
      },
      (code, reason) => {
        this.logger.warn(`Depth WS closed [${code}] ${reason.toString()}`);
        if (!this.isShuttingDown) {
          this.depthReconnectTimer = setTimeout(() => {
            this.depthReconnectDelay = Math.min(this.depthReconnectDelay * 2, WS_MAX_RECONNECT_DELAY_MS);
            this.connectDepth();
          }, this.depthReconnectDelay);
        }
      },
    );
  }

  private onDepthMessage(raw: WebSocket.RawData): void {
    let msg: CombinedMsg;
    try {
      msg = JSON.parse((raw as Buffer).toString('utf8')) as CombinedMsg;
    } catch {
      return;
    }

    const symbol = msg.stream?.split('@')[0]?.toUpperCase();
    const token = symbol ? this.tokens.get(symbol) : undefined;
    if (!token) return;

    const d = msg.data as DepthData;
    const ob: OrderBook = {
      bids: parseLevels(d.bids),
      asks: parseLevels(d.asks),
    };

    token.orderBook = ob;
    const bestBid = ob.bids[0]?.price ?? token.bestBid;
    const bestAsk = ob.asks[0]?.price ?? token.bestAsk;
    token.bestBid = bestBid;
    token.bestAsk = bestAsk;
    token.spread = bestAsk > 0 && bestBid > 0 ? bestAsk - bestBid : token.spread;

    const diff: Omit<TokenDiff, 'seq'> = {
      productId: token.productId,
      price: 0, // sentinel: order-book-only update, frontend skips price fields
      priceChange24h: 0,
      high24h: 0,
      low24h: 0,
      bestBid,
      bestAsk,
      spread: token.spread,
      volume24h: 0,
      orderBook: ob,
      updatedAt: Date.now(),
    };

    this.onDiffCallback?.(diff);
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  private openWs(url: string, onMessage: (raw: WebSocket.RawData) => void, onOpen: () => void, onClose: (code: number, reason: Buffer) => void): WebSocket {
    const ws = new WebSocket(url);
    ws.on('open', onOpen);
    ws.on('message', onMessage);
    ws.on('error', (err) => this.logger.error('Binance WS error', err.message));
    ws.on('close', onClose);
    return ws;
  }

  private cleanupWs(ws: WebSocket | null): void {
    if (!ws) return;
    ws.removeAllListeners();
    try {
      ws.close();
    } catch {
      /* ignore */
    }
  }
}
