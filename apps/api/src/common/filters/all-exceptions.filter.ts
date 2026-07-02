import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { PinoLogger } from 'nestjs-pino';

import { RequestContext } from '@/common/context/request-context';
import { AppException } from '@/common/exceptions/app.exception';

interface ResolvedException {
  status: number;
  code?: string;
  message: string | string[];
  shouldLog: boolean;
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

    const { status, code, message, shouldLog } = this.resolve(exception);

    if (shouldLog) {
      this.logger.error({ err: exception, path: request.url }, 'Unhandled exception');
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
        shouldLog: false,
      };
    }

    if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();
      const message =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : ((exceptionResponse as { message?: string | string[] }).message ?? exception.message);
      return { status: exception.getStatus(), message, shouldLog: false };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      shouldLog: true,
    };
  }
}
