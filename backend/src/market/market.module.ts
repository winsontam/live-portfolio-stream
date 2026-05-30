import { Module } from '@nestjs/common';
import { BinanceModule } from '../binance/binance.module';
import { MarketController } from './market.controller';
import { MarketGateway } from './market.gateway';

@Module({
  imports: [BinanceModule],
  controllers: [MarketController],
  providers: [MarketGateway],
})
export class MarketModule {}
