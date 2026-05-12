import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { db } from '../database/drizzle';
import { AuthRepository } from './v1/auth.repository';

export interface JwtPayload {
  sub: string;
  email: string;
  roles: string[];
  hospitalIds?: string[];
  professionalId?: string;
  mfa?: boolean;
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  roles: string[];
  hospitalIds: string[];
  hospitalId?: string;
  professionalId?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly authRepository: AuthRepository,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      issuer: config.getOrThrow<string>('JWT_ISSUER'),
      audience: config.getOrThrow<string>('JWT_AUDIENCE'),
      algorithms: ['HS256'],
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    if (!payload?.sub || !payload?.email) {
      throw new UnauthorizedException('Malformed token');
    }
    const user = await this.authRepository.findUserById(db, payload.sub);
    if (!user || user.email.toLowerCase() !== payload.email.toLowerCase()) {
      throw new UnauthorizedException('User not valid');
    }
    const hospitalIds = payload.hospitalIds ?? [];
    return {
      id: payload.sub,
      email: payload.email,
      roles: payload.roles ?? [],
      hospitalIds,
      hospitalId: hospitalIds[0],
      professionalId: payload.professionalId,
    };
  }
}
