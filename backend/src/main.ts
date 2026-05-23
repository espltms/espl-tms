import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS for frontend dashboard and live websocket feeds
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Strict data validations
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Enterprise API prefixing
  app.setGlobalPrefix('api');

  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`\n======================================================`);
  console.log(`🚀 TMS Enterprise API Server listening on: http://localhost:${port}/api`);
  console.log(`📡 WebSocket Dispatch Gateway running on namespace: /dispatch`);
  console.log(`======================================================\n`);
}

bootstrap();
