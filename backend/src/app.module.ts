import { Module } from '@nestjs/common';
import { EnvModule } from './env/env.module';
import { MarketModule } from './market/market.module';

@Module({
  imports: [EnvModule.forRoot({ envFilePath: '.env' }), MarketModule],
})
export class AppModule {}
