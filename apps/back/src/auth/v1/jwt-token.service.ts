import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

export interface AccessTokenClaims {
  sub: string;
  email: string;
  roles: string[];
  hospitalIds: string[];
  professionalId?: string;
  mfa: boolean;
}

@Injectable()
export class JwtTokenService {
  private readonly accessSecret: string;
  private readonly accessTtl: string;
  private readonly issuer: string;
  private readonly audience: string;

  constructor(private readonly jwt: JwtService, config: ConfigService) {
    this.accessSecret = config.getOrThrow<string>('JWT_ACCESS_SECRET');
    this.accessTtl = config.getOrThrow<string>('JWT_ACCESS_TTL');
    this.issuer = config.getOrThrow<string>('JWT_ISSUER');
    this.audience = config.getOrThrow<string>('JWT_AUDIENCE');
  }

  signAccessToken(claims: AccessTokenClaims): { token: string; expiresIn: number } {
    const token = this.jwt.sign(claims, {
      secret: this.accessSecret,
      expiresIn: this.accessTtl,
      issuer: this.issuer,
      audience: this.audience,
      algorithm: 'HS256',
    });
    return { token, expiresIn: ttlToSeconds(this.accessTtl) };
  }
}

function ttlToSeconds(ttl: string): number {
  const match = /^(\d+)([smhd])$/.exec(ttl);
  if (!match) return 900;
  const value = Number(match[1]);
  const unit = match[2];
  switch (unit) {
    case 's':
      return value;
    case 'm':
      return value * 60;
    case 'h':
      return value * 3600;
    case 'd':
      return value * 86400;
    default:
      return 900;
  }
}
