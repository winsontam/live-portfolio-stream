export interface OrderBookLevel {
  price: number;
  size: number;
}

export interface OrderBook {
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
}

export interface Token {
  productId: string;
  baseCurrency: string;
  quoteCurrency: string;
  displayName: string;
  price: number;
  priceChange24h: number;   // percentage e.g. 2.5 = +2.5%
  high24h: number;
  low24h: number;
  bestBid: number;
  bestAsk: number;
  spread: number;
  volume24h: number;
  orderBook: OrderBook;
  status: string;
  cachedAt: number;
}

export interface TokenDiff {
  productId: string;
  seq: number;
  price: number;
  priceChange24h: number;
  high24h: number;
  low24h: number;
  bestBid: number;
  bestAsk: number;
  spread: number;
  volume24h: number;
  orderBook?: OrderBook;
  updatedAt: number;
}
