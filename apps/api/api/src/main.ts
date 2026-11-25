import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { RedisIoAdapter } from './battle/redis-io.adapter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.use(json({ limit: '1mb' }));
  app.use(urlencoded({ extended: true, limit: '1mb' }));

  app.enableCors({
    origin: true,
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

  console.log(`QUIZ ARENA API: http://0.0.0.0:${port}`);
}

void bootstrap();
