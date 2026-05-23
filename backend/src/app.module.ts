import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

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
  ],
  controllers: [
    AuthController,
    TripController,
    ComplianceController,
    FinanceController,
  ],
  providers: [
    JwtStrategy,
    DispatchGateway,
  ],
})
export class AppModule {}
