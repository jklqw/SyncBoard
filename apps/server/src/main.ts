import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WsAdapter } from '@nestjs/platform-ws';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { LoggerModule } from 'nestjs-pino';
import { AppModule } from './app.module';
import { API_PREFIX } from './common/constants/limits';
import {
  ENV,
  parseCorsOrigins,
  toWsOrigin,
  type Env,
} from './common/config/env.schema';

function buildHelmet(env: Env) {
  const webOrigins = parseCorsOrigins(env.CORS_ORIGIN);
  let mediaOrigin: string | null = null;
  try {
    mediaOrigin = new URL(env.MINIO_PUBLIC_URL).origin;
  } catch {
    mediaOrigin = null;
  }

  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:', ...(mediaOrigin ? [mediaOrigin] : [])],
        mediaSrc: ["'self'", 'data:', 'blob:', ...(mediaOrigin ? [mediaOrigin] : [])],
        connectSrc: [
          "'self'",
          ...webOrigins,
          ...webOrigins.map(toWsOrigin),
          ...(mediaOrigin ? [mediaOrigin] : []),
        ],
        fontSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.useWebSocketAdapter(new WsAdapter(app));
  app.enableShutdownHooks();

  const env = app.get<Env>(ENV);

  app.use(buildHelmet(env));
  app.use(cookieParser());
  app.enableCors({
    origin: parseCorsOrigins(env.CORS_ORIGIN),
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });
  app.setGlobalPrefix(API_PREFIX);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = env.PORT;
  await app.listen(port);
  app.get(Logger).log(`SyncBoard API listening on http://localhost:${port}/${API_PREFIX}`);
}

void bootstrap();
