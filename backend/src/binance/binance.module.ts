import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { BinanceDataService } from './binance-data.service';
import { BinanceService } from './binance.service';

@Module({
  imports: [HttpModule],
  providers: [BinanceDataService, BinanceService],
  exports: [BinanceDataService, BinanceService],
})
export class BinanceModule {}
