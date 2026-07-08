import { LoggerService } from '@nestjs/common';
import { createLogger, format, transports, Logger as WinstonLogger } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { als } from './request-context';

// ─── Sensitive field scrubbing ────────────────────────────────────────────────
// Fields that must never appear in structured log output.
const REDACT_KEYS = new Set([
  'password', 'newpassword', 'currentpassword', 'passwordhash',
  'token', 'secret', 'authorization', 'cookie',
  'crm_access', 'crm_refresh', 'avatardata',
]);

function redact(obj: unknown, depth = 0): unknown {
  if (depth > 5 || obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map((v) => redact(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    out[k] = REDACT_KEYS.has(k.toLowerCase()) ? '[REDACTED]' : redact(v, depth + 1);
  }
  return out;
}

// ─── Message normalisation ────────────────────────────────────────────────────
// NestJS calls logger methods in several patterns:
//   log(message, context?)
//   error(message, stackTrace?, context?)
//   warn(message, context?)
// where context is the class name string registered with `new Logger(name)`.

interface Normalised {
  msg: string;
  context?: string;
  stack?: string;
  meta?: Record<string, unknown>;
}

function normalise(message: unknown, optionalParams: unknown[]): Normalised {
  // Context is the last string argument (NestJS always puts it last)
  const strings = optionalParams.filter((p): p is string => typeof p === 'string');
  const context = strings.length ? strings[strings.length - 1] : undefined;

  // Stack: Error instance, or a multi-line string that looks like a stack trace
  const errObj =
    (message instanceof Error ? message : undefined) ??
    optionalParams.find((p): p is Error => p instanceof Error);

  const stackStr = strings
    .slice(0, strings.length - 1) // exclude context
    .find((s) => s.includes('\n') || s.startsWith('Error') || s.startsWith('    at '));

  const stack = errObj?.stack ?? stackStr;

  // Extra metadata (plain objects that are not Error instances)
  const metaObj = optionalParams.find(
    (p): p is Record<string, unknown> =>
      typeof p === 'object' && p !== null && !(p instanceof Error),
  );

  const msg =
    errObj
      ? errObj.message
      : typeof message === 'string'
        ? message
        : JSON.stringify(message);

  return {
    msg,
    context,
    stack,
    meta: metaObj ? (redact(metaObj) as Record<string, unknown>) : undefined,
  };
}

// ─── AppLoggerService ─────────────────────────────────────────────────────────

export class AppLoggerService implements LoggerService {
  private readonly winston: WinstonLogger;

  constructor() {
    const isDev   = process.env.NODE_ENV !== 'production';
    const logDir  = process.env.LOG_DIR ?? 'logs';

    // Stamp requestId + userId from the current async context onto every log entry.
    const enrichFromAls = format((info) => {
      const store = als.getStore();
      if (store?.requestId) info['requestId'] = store.requestId;
      if (store?.userId)    info['userId']    = store.userId;
      return info;
    });

    // Human-readable single-line format for development console.
    const devFormat = format.combine(
      format.timestamp({ format: 'HH:mm:ss.SSS' }),
      enrichFromAls(),
      format.colorize({ all: true }),
      format.printf(({ timestamp, level, context, requestId, userId, message, stack, ...rest }) => {
        const ctx  = context   ? ` [${context}]` : '';
        const req  = requestId ? ` req=${requestId}` : '';
        const uid  = userId    ? ` uid=${userId}` : '';
        const xtra = Object.keys(rest).length
          ? `  ${JSON.stringify(rest)}`
          : '';
        const stk  = stack ? `\n${stack}` : '';
        return `${timestamp} ${level}${ctx}${req}${uid} ${message}${xtra}${stk}`;
      }),
    );

    // JSON format used in production console and all log files.
    const jsonFormat = format.combine(
      format.timestamp(),
      enrichFromAls(),
      format.errors({ stack: true }),
      format.json(),
    );

    this.winston = createLogger({
      level: isDev ? 'debug' : 'info',
      transports: [
        // Console — dev gets colored text; prod gets JSON
        new transports.Console({
          level: isDev ? 'debug' : 'info',
          format: isDev ? devFormat : jsonFormat,
        }),

        // All events ≥ INFO → app-YYYY-MM-DD.log (14-day retention, 20 MB per file)
        new DailyRotateFile({
          level: 'info',
          dirname: logDir,
          filename: 'app-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          maxFiles: '14d',
          maxSize: '20m',
          format: jsonFormat,
          auditFile: `${logDir}/.rotate-audit-app.json`,
        }),

        // ERROR-only → error-YYYY-MM-DD.log (30-day retention, 20 MB per file)
        new DailyRotateFile({
          level: 'error',
          dirname: logDir,
          filename: 'error-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          maxFiles: '30d',
          maxSize: '20m',
          format: jsonFormat,
          auditFile: `${logDir}/.rotate-audit-error.json`,
        }),
      ],
    });
  }

  private write(level: string, message: unknown, optionalParams: unknown[]): void {
    const { msg, context, stack, meta } = normalise(message, optionalParams);
    this.winston.log(level, {
      message: msg,
      ...(context && { context }),
      ...(stack   && { stack }),
      ...(meta    && meta),
    });
  }

  log(message: unknown, ...optionalParams: unknown[]): void {
    this.write('info', message, optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    this.write('error', message, optionalParams);
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.write('warn', message, optionalParams);
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.write('debug', message, optionalParams);
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.write('verbose', message, optionalParams);
  }
}
