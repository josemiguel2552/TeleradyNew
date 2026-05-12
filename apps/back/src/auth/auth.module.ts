import { Global, Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';
import { AuthRepository } from './auth.repository';
import { AbilityFactory } from './abilities/ability.factory';
import { RolesGuard } from './guards/roles.guard';

@Global()
@Module({
  imports: [PassportModule],
  providers: [JwtStrategy, AuthRepository, AbilityFactory, RolesGuard],
  exports: [PassportModule, AuthRepository, AbilityFactory, RolesGuard],
})
export class AuthModule {}
