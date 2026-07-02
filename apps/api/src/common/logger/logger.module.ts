import { Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';

import { RequestContext } from '@/common/context/request-context';

@Module({
  imports: [
    PinoLoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        transport:
          process.env.NODE_ENV === 'production'
            ? undefined
            : { target: 'pino-pretty', options: { singleLine: true, colorize: true } },
        mixin: () => {
          const correlationId = RequestContext.correlationId;
          return correlationId ? { correlationId } : {};
        },
        redact: ['req.headers.authorization', 'req.headers.cookie'],
      },
    }),
  ],
})
export class LoggerModule {}
