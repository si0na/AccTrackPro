import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { als } from '../logger/request-context';

/**
 * Establishes the AsyncLocalStorage context for every incoming HTTP request.
 * Must run before guards, interceptors, and handlers so all downstream async
 * operations inherit the store (requestId, and later userId from the interceptor).
 *
 * X-Request-Id: if the client sends one it is echoed back; otherwise a new UUID
 * is generated. Either way the value is set on the response header and stored
 * in the ALS context for structured log enrichment.
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const requestId =
      (req.headers['x-request-id'] as string | undefined)?.slice(0, 64) ||
      randomUUID();

    res.setHeader('X-Request-Id', requestId);

    als.run({ requestId }, next);
  }
}
