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
            : {
                target: 'pino-pretty',
                options: {
                  singleLine: true,
                  colorize: true,
                  customColors: 'info:green,warn:yellow,error:red,greyMessage:white',
                },
              },
        mixin: () => {
          const correlationId = RequestContext.correlationId;
          return correlationId ? { correlationId } : {};
        },
        serializers: {
          req: (req) => ({ method: req.method, url: req.url }),
          res: (res) => ({ statusCode: res.statusCode }),
        },
        customSuccessMessage: (req, res) => `${req.method} ${req.url} -> ${res.statusCode}`,
        customErrorMessage: (req, res, err) =>
          `${req.method} ${req.url} -> ${res.statusCode} (${err.message})`,
      },
    }),
  ],
})
export class LoggerModule {}
