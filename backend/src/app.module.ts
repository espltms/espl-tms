import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

// Database & Socket Gateway
import { PrismaModule } from './infrastructure/database/prisma.module';
import { DispatchGateway } from './infrastructure/socket/dispatch.gateway';

// Security Configuration
import { JwtStrategy } from './infrastructure/security/jwt.strategy';

// Presentation Layer Controllers
import { AuthController } from './interface/controllers/auth.controller';
import { TripController } from './interface/controllers/trip.controller';
import { ComplianceController } from './interface/controllers/compliance.controller';
import { FinanceController } from './interface/controllers/finance.controller';
import { HealthController } from './interface/controllers/health.controller';

// Production configuration sanity checks
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('CRITICAL CONFIGURATION ERROR: JWT_SECRET environment variable must be defined in production!');
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET || 'ProductionEnterpriseSuperSecretJWTKey2026!!',
      signOptions: { expiresIn: '8h' }, // Enterprise session window
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute
        limit: 100, // 100 requests per minute per IP
      },
    ]),
  ],
  controllers: [
    AuthController,
    TripController,
    ComplianceController,
    FinanceController,
    HealthController,
  ],
  providers: [
    JwtStrategy,
    DispatchGateway,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
