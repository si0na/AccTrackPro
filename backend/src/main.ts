import 'reflect-metadata';
import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ValidationPipe, RequestMethod } from '@nestjs/common';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { AppLoggerService } from './common/logger/app-logger.service';
import { validateEnvironment } from './config/env.validation';

async function bootstrap() {
  // Instantiate the logger before NestFactory so startup logs are captured.
  const logger = new AppLoggerService();

  // ── Environment validation (fail fast before any module initialises) ───────
  const envResult = validateEnvironment();
  for (const line of envResult.summary) logger.log(line, 'EnvValidation');
  for (const warning of envResult.warnings) logger.warn(warning, 'EnvValidation');
  if (envResult.errors.length > 0) {
    for (const error of envResult.errors) logger.error(error, undefined, 'EnvValidation');
    throw new Error(
      `Environment validation failed with ${envResult.errors.length} error(s) — see logs above`,
    );
  }
  logger.log('Environment validation passed', 'EnvValidation');

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger,
    // Buffer NestJS internal logs (RoutesResolver, InstanceLoader, etc.) until
    // the logger is active so they are written in structured JSON/text format.
    bufferLogs: true,
  });

  // Raise the JSON body limit above the 100kb Express default so bulk-import
  // batches (arrays of records) are accepted. The import client still chunks
  // large files into batches, but a single batch of rich rows can exceed 100kb.
  app.useBodyParser('json', { limit: '15mb' });
  app.useBodyParser('urlencoded', { limit: '15mb', extended: true });

  // ── Security headers (Helmet) ──────────────────────────────────────────────
  // CSP disabled: pure REST API, no HTML served from this process
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }));

  // ── Cookie parser (required before guards read req.cookies) ────────────────
  app.use(cookieParser());

  // ── CORS ────────────────────────────────────────────────────────────────────
  const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:5173';
  app.enableCors({
    origin: allowedOrigin,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true, // required for HttpOnly cookies
  });

  app.setGlobalPrefix('api', {
    exclude: [{ path: 'health', method: RequestMethod.GET }],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false, // keep permissive — custom column keys are dynamic
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  const PORT = parseInt(process.env.PORT || '3000', 10);
  await app.listen(PORT);

  logger.log(`CRM API running at http://localhost:${PORT}/api`, 'Bootstrap');

  // ── Graceful shutdown ──────────────────────────────────────────────────────
  const shutdown = async (signal: string) => {
    logger.log(`${signal} received — shutting down gracefully`, 'Bootstrap');
    await app.close();
    logger.log('HTTP server closed', 'Bootstrap');
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT',  () => void shutdown('SIGINT'));
}

bootstrap().catch((err: unknown) => {
  // Bootstrap errors go straight to stderr; the logger may not be ready yet.
  console.error('[Bootstrap] Fatal startup error:', err);
  process.exit(1);
});
