import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { EnvService } from './env/env.service';
import { RedisIoAdapter } from './common/redis-io.adapter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
    bufferLogs: false,
  });

  const env = app.get(EnvService);

  app.enableCors({
    origin: env.get('CORS_ORIGIN'),
    methods: ['GET', 'POST', 'OPTIONS'],
    credentials: true,
  });

  const redisIoAdapter = new RedisIoAdapter(app);
  redisIoAdapter.connectToRedis(env.get('REDIS_URL'));
  app.useWebSocketAdapter(redisIoAdapter);

  const port = env.get('PORT');
  await app.listen(port);
  console.log(`HTTP  → http://localhost:${port}`);
  console.log(`WS    → ws://localhost:${port}/market`);
}
void bootstrap();
