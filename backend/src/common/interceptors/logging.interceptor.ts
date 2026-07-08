import {
  Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request, Response } from 'express';
import { als } from '../logger/request-context';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req  = http.getRequest<Request & { user?: { sub?: string } }>();
    const res  = http.getResponse<Response>();
    const { method, url } = req;
    const start = Date.now();

    // Enrich the ALS store with the authenticated userId once guards have run.
    // Guards execute before interceptors, so req.user is already populated here.
    const store = als.getStore();
    if (store && req.user?.sub) store.userId = req.user.sub;

    return next.handle().pipe(
      tap({
        next: () => {
          const ms     = Date.now() - start;
          const status = res.statusCode;
          this.logger.log(`${method} ${url} ${status} ${ms}ms`);
        },
        error: (err: unknown) => {
          // The HttpExceptionFilter will log the full error details including
          // stack trace and request context. Here we only log a one-line
          // summary so the interceptor's timing is still recorded.
          const ms     = Date.now() - start;
          const status = (err as { status?: number })?.status ?? 500;
          this.logger.warn(`${method} ${url} ${status} ${ms}ms`);
        },
      }),
    );
  }
}
