import { Injectable } from '@nestjs/common';
import { BinanceDataService } from './binance-data.service';
import type { Token } from './binance.types';

@Injectable()
export class BinanceService {
  constructor(private readonly data: BinanceDataService) {}

  getAllTokens(): Token[] {
    return this.data.getAllTokens();
  }
  getToken(productId: string): Token | undefined {
    return this.data.getToken(productId);
  }
}
