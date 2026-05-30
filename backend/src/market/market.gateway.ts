import { OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { BinanceService } from '../binance/binance.service';
import { BinanceDataService } from '../binance/binance-data.service';
import type { TokenDiff } from '../binance/binance.types';

const RING_BUFFER_SIZE = 500;

@WebSocketGateway({ namespace: '/market', cors: { origin: '*' } })
export class MarketGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnApplicationBootstrap {
  private readonly logger = new Logger(MarketGateway.name);

  @WebSocketServer()
  private readonly server: Server;

  private readonly updateBuffer: TokenDiff[] = [];

  constructor(
    private readonly binanceService: BinanceService,
    private readonly binanceDataService: BinanceDataService,
  ) {}

  afterInit(): void {
    this.logger.log('Market WebSocket gateway initialised');
  }

  onApplicationBootstrap(): void {
    this.binanceDataService.setOnDiff((diff) => this.broadcastUpdate(diff));
    this.logger.log('Registered diff callback on BinanceDataService');
  }

  handleConnection(client: Socket): void {
    this.logger.debug(`Client connected: ${client.id}`);
    this.sendSnapshot(client);
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('market:reconnect')
  handleReconnect(client: Socket, payload: { since: number }): void {
    const since = payload?.since ?? 0;
    const oldest = this.updateBuffer[0]?.updatedAt ?? Infinity;
    const missed = this.updateBuffer.filter((u) => u.updatedAt > since);

    if (missed.length > 0 && since >= oldest) {
      // Client is within buffer range — replay missed updates
      for (const u of missed) client.emit('market:update', u);
    } else {
      // Gap too large or no buffer — send fresh snapshot
      this.sendSnapshot(client);
    }
  }

  @SubscribeMessage('market:subscribe-book')
  handleSubscribeBook(client: Socket, payload: { productId: string }): void {
    if (!payload?.productId) return;
    const room = `book:${payload.productId.toUpperCase()}`;
    void client.join(room);
    this.logger.debug(`Book subscribe: ${client.id} → ${room}`);

    // Send current order book snapshot immediately
    const token = this.binanceService.getToken(payload.productId.toUpperCase());
    if (token?.orderBook) {
      client.emit('market:update', {
        productId: token.productId,
        price: 0,
        priceChange24h: 0,
        high24h: 0,
        low24h: 0,
        bestBid: 0,
        bestAsk: 0,
        spread: 0,
        volume24h: 0,
        orderBook: token.orderBook,
        updatedAt: token.cachedAt,
      });
    }
  }

  @SubscribeMessage('market:unsubscribe-book')
  handleUnsubscribeBook(client: Socket, payload: { productId: string }): void {
    if (!payload?.productId) return;
    const room = `book:${payload.productId.toUpperCase()}`;
    void client.leave(room);
    this.logger.debug(`Book unsubscribe: ${client.id} → ${room}`);
  }

  private sendSnapshot(client: Socket): void {
    const tokens = this.binanceService.getAllTokens();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const stripped = tokens.map(({ orderBook: _ob, ...rest }) => rest);
    client.emit('market:snapshot', { tokens: stripped });
    this.logger.debug(`Snapshot → ${client.id}: ${stripped.length} tokens`);
  }

  private broadcastUpdate(diff: TokenDiff): void {
    this.updateBuffer.push(diff);
    if (this.updateBuffer.length > RING_BUFFER_SIZE) this.updateBuffer.shift();

    if (diff.orderBook) {
      // Order book diff — only send to clients in the book room
      this.server.to(`book:${diff.productId.toUpperCase()}`).emit('market:update', diff);
    } else {
      // Price/ticker diff — broadcast to everyone
      this.server.emit('market:update', diff);
    }
  }
}
