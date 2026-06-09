import helmet from 'helmet';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Helmet HTTP security headers
  app.use(helmet());

  // Dynamic CORS configuration
  const isProd = process.env.NODE_ENV === 'production';
  const allowedOrigins = process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(',').map(url => url.trim())
    : [];

  app.enableCors({
    origin: (origin, callback) => {
      // Allow all origins in development or if FRONTEND_URL is not configured
      if (!isProd || !process.env.FRONTEND_URL) {
        return callback(null, true);
      }
      // Check against configured allowed origins
      if (origin && allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS policy blocked request from origin: ${origin}`));
      }
    },
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
