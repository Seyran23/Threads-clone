import { ArgumentsHost, BadRequestException, HttpStatus, NotFoundException } from '@nestjs/common';
import { Request, Response } from 'express';
import { PinoLogger } from 'nestjs-pino';

import { RequestContext } from '@/common/context/request-context';
import { ConflictException } from '@/common/exceptions/app.exception';

import { AllExceptionsFilter } from './all-exceptions.filter';

function createMockHost(): { host: ArgumentsHost; response: jest.Mocked<Response> } {
  const response = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  } as unknown as jest.Mocked<Response>;

  const request = { url: '/test-path' } as Request;

  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;

  return { host, response };
}

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let logger: jest.Mocked<PinoLogger>;

  beforeEach(() => {
    logger = {
      setContext: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    } as unknown as jest.Mocked<PinoLogger>;
    filter = new AllExceptionsFilter(logger);
  });

  it('maps an AppException to its own status/code/message, logging it as a warning', () => {
    const { host, response } = createMockHost();

    filter.catch(new ConflictException('Email is already registered'), host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.CONFLICT,
        code: 'CONFLICT',
        message: 'Email is already registered',
      }),
    );
    expect(logger.warn).toHaveBeenCalledWith(
      { path: '/test-path', status: HttpStatus.CONFLICT, code: 'CONFLICT' },
      'Email is already registered',
    );
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('maps a string-response HttpException, logging it as a warning', () => {
    const { host, response } = createMockHost();

    filter.catch(new NotFoundException('Route not found'), host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: HttpStatus.NOT_FOUND, message: 'Route not found' }),
    );
    expect(logger.warn).toHaveBeenCalledWith(
      { path: '/test-path', status: HttpStatus.NOT_FOUND, code: undefined },
      'Route not found',
    );
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('extracts the message array from an object-response HttpException (ValidationPipe-style)', () => {
    const { host, response } = createMockHost();

    filter.catch(new BadRequestException({ message: ['email must be an email'] }), host);

    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: ['email must be an email'] }),
    );
    expect(logger.warn).toHaveBeenCalledWith(expect.anything(), 'email must be an email');
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('maps an unrecognized error to a generic 500 without leaking its message, and logs it', () => {
    const { host, response } = createMockHost();

    filter.catch(new Error('database connection string is postgres://secret'), host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
      }),
    );
    expect(logger.error).toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('includes the current correlation ID from RequestContext', () => {
    const { host, response } = createMockHost();

    RequestContext.run({ correlationId: 'test-corr-id' }, () => {
      filter.catch(new NotFoundException('missing'), host);
    });

    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ correlationId: 'test-corr-id' }),
    );
  });
});
