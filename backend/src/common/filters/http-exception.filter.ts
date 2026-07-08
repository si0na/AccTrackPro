import {
  ExceptionFilter, Catch, ArgumentsHost,
  HttpException, HttpStatus, Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { als } from '../logger/request-context';

// Map HTTP status codes to short reason phrases.
const STATUS_TEXT: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  409: 'Conflict',
  410: 'Gone',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
};

/**
 * Global exception filter — catches every unhandled exception.
 *
 * Logging strategy:
 *   4xx  →  warn  (client errors; no stack trace logged)
 *   5xx  →  error (server errors; full stack trace logged)
 *   401/403 → warn with "security" tag for easier alerting
 *
 * Response shape (always JSON):
 * {
 *   statusCode: number,
 *   error:      string,          // HTTP reason phrase
 *   message:    string,          // human-readable detail
 *   requestId:  string,          // from X-Request-Id / ALS
 *   timestamp:  string,          // ISO-8601
 *   path:       string           // request URL
 * }
 *
 * Sensitive information (passwords, tokens, cookies) is never included
 * in either the log output or the response body.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx      = host.switchToHttp();
    const request  = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = this.extractMessage(exception);
    const error   = STATUS_TEXT[status] ?? 'Error';

    // Pull requestId from ALS (set by RequestIdMiddleware) or fall back to header.
    const store     = als.getStore();
    const requestId = store?.requestId
      ?? (request.headers['x-request-id'] as string | undefined)
      ?? 'unknown';

    const timestamp = new Date().toISOString();
    const { method, url } = request;
    const userId = store?.userId;

    // ── Structured logging ────────────────────────────────────────────────────
    const logMeta = {
      method,
      url,
      status,
      requestId,
      ...(userId && { userId }),
    };

    if (status >= 500) {
      const stack = exception instanceof Error ? exception.stack : undefined;
      this.logger.error(
        `${method} ${url} ${status} — ${message}`,
        stack,
        HttpExceptionFilter.name,
      );
      // Also emit a structured object for file transports
      this.logger.error(message, { ...logMeta, stack });
    } else if (status === 401 || status === 403) {
      this.logger.warn(`[SECURITY] ${method} ${url} ${status} — ${message}`, logMeta);
    } else {
      this.logger.warn(`${method} ${url} ${status} — ${message}`, logMeta);
    }

    // ── Consistent error response ─────────────────────────────────────────────
    response.status(status).json({
      statusCode: status,
      error,
      message,
      requestId,
      timestamp,
      path: url,
    });
  }

  private extractMessage(exception: unknown): string {
    if (!(exception instanceof HttpException)) {
      return 'An unexpected error occurred';
    }

    const raw = exception.getResponse();

    if (typeof raw === 'string') return raw;

    if (typeof raw === 'object' && raw !== null) {
      const r = raw as Record<string, unknown>;
      // class-validator returns { message: string[] } for validation errors
      if (Array.isArray(r['message'])) {
        return (r['message'] as string[])[0] ?? 'Validation failed';
      }
      if (typeof r['message'] === 'string') return r['message'];
    }

    return 'An error occurred';
  }
}
