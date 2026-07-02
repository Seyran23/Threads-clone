import { randomUUID } from 'node:crypto';

import { NextFunction, Request, Response } from 'express';

import { RequestContext } from '@/common/context/request-context';

export const CORRELATION_ID_HEADER = 'x-correlation-id';

export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.headers[CORRELATION_ID_HEADER];
  const headerValue = Array.isArray(incoming) ? incoming[0] : incoming;
  const correlationId = headerValue && headerValue.length > 0 ? headerValue : randomUUID();

  res.setHeader(CORRELATION_ID_HEADER, correlationId);
  RequestContext.run({ correlationId }, next);
}
