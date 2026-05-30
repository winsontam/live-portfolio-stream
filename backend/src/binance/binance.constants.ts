export const BINANCE_REST_BASE = 'https://api.binance.com/api/v3';
export const BINANCE_WS_BASE = 'wss://stream.binance.com:9443/stream';

/** Stablecoin quote currencies to include */
export const STABLECOIN_QUOTE_CURRENCIES = ['USDT', 'USDC'];

/** Number of order book levels to keep per side */
export const ORDER_BOOK_DEPTH = 20;

export const WS_RECONNECT_DELAY_MS = 2_000;
export const WS_MAX_RECONNECT_DELAY_MS = 30_000;
