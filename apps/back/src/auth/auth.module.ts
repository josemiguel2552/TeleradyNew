import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AbilityFactory } from './abilities/ability.factory';
import { RolesGuard } from './guards/roles.guard';
import { JwtStrategy } from './jwt.strategy';
import { AuthController } from './v1/auth.controller';
import { AuthRepository } from './v1/auth.repository';
import { AuthService } from './v1/auth.service';
import { JwtTokenService } from './v1/jwt-token.service';
import { RefreshTokenService } from './v1/refresh-token.service';

@Global()
@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    JwtStrategy,
    AuthRepository,
    AuthService,
    JwtTokenService,
    RefreshTokenService,
    AbilityFactory,
    RolesGuard,
  ],
  exports: [
    PassportModule,
    JwtModule,
    AuthRepository,
    AuthService,
    JwtTokenService,
    RefreshTokenService,
    AbilityFactory,
    RolesGuard,
  ],
})
export class AuthModule {}
