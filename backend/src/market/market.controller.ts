import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { BinanceService } from '../binance/binance.service';
import type { Token } from '../binance/binance.types';

@Controller('markets')
export class MarketController {
  constructor(private readonly binanceService: BinanceService) {}

  @Get()
  getAll(): Token[] {
    return this.binanceService.getAllTokens();
  }

  @Get(':productId')
  getOne(@Param('productId') productId: string): Token {
    const token = this.binanceService.getToken(productId.toUpperCase());
    if (!token) throw new NotFoundException(`Token ${productId} not found`);
    return token;
  }
}
