import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { json, raw, urlencoded } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { RedisIoAdapter } from './battle/redis-io.adapter';
import { getAllowedCorsOrigins, isAllowedCorsOrigin } from './cors.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  // Prevent body-less 304 responses from breaking mobile API clients that do
  // not maintain a corresponding HTTP cache. User/account data is always fresh.
  const httpApp = app.getHttpAdapter().getInstance();
  httpApp.disable('etag');
  httpApp.use((_request: Request, response: Response, next: NextFunction) => {
    response.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    response.setHeader('Pragma', 'no-cache');
    next();
  });

  app.use(raw({ type: ['image/*', 'video/*', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'], limit: '50mb' }));
  app.use(json({ limit: '1mb' }));
  app.use(urlencoded({ extended: true, limit: '1mb' }));

  const allowedOrigins = getAllowedCorsOrigins();
  app.enableCors({
    origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
      if (isAllowedCorsOrigin(origin, allowedOrigins)) return callback(null, true);
      return callback(null, false);
    },
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'Range'],
    exposedHeaders: ['Accept-Ranges', 'Content-Length', 'Content-Range', 'Content-Type'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const socketAdapter = new RedisIoAdapter(app);
  await socketAdapter.connectToRedis();
  app.useWebSocketAdapter(socketAdapter);

  // Close the dedicated Redis Pub/Sub connections during graceful shutdown.
  app.getHttpServer().once('close', () => {
    void socketAdapter.closeRedisConnections();
  });

  // Allow Railway and other orchestrators to close HTTP and Socket.IO cleanly.
  app.enableShutdownHooks();

  const port = Number(process.env.PORT) || 3000;

  await app.listen(port, '0.0.0.0');

  console.log(`ZELQEN CORE API: http://0.0.0.0:${port}`);
}

void bootstrap();
