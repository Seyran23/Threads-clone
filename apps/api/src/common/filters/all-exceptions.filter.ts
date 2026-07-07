import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { PinoLogger } from 'nestjs-pino';

import { RequestContext } from '@/common/context/request-context';
import { AppException } from '@/common/exceptions/app.exception';

interface ResolvedException {
  status: number;
  code?: string;
  message: string | string[];
  logLevel: 'warn' | 'error';
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(AllExceptionsFilter.name);
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, code, message, logLevel } = this.resolve(exception);

    if (logLevel === 'error') {
      this.logger.error({ err: exception, path: request.url }, 'Unhandled exception');
    } else {
      this.logger.warn(
        { path: request.url, status, code },
        Array.isArray(message) ? message.join('; ') : message,
      );
    }

    response.status(status).json({
      statusCode: status,
      ...(code ? { code } : {}),
      correlationId: RequestContext.correlationId,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }

  private resolve(exception: unknown): ResolvedException {
    if (exception instanceof AppException) {
      return {
        status: exception.statusCode,
        code: exception.code,
        message: exception.message,
        logLevel: 'warn',
      };
    }

    if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();
      const message =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : ((exceptionResponse as { message?: string | string[] }).message ?? exception.message);
      return { status: exception.getStatus(), message, logLevel: 'warn' };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      logLevel: 'error',
    };
  }
}
