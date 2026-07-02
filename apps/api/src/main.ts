import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';

import { correlationIdMiddleware } from '@/common/middleware/correlation-id.middleware';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.use(correlationIdMiddleware);
  app.useLogger(app.get(Logger));
  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
