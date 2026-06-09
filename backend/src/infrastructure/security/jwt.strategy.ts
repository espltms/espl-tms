import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    const isProd = process.env.NODE_ENV === 'production';
    const secret = process.env.JWT_SECRET;
    
    if (isProd && !secret) {
      throw new Error('CRITICAL CONFIGURATION ERROR: JWT_SECRET environment variable must be defined in production!');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret || 'ProductionEnterpriseSuperSecretJWTKey2026!!',
    });
  }

  async validate(payload: any) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, fullName: true, role: true, isActive: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User is suspended or deactivated');
    }

    return user;
  }
}
