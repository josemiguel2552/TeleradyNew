import { Module } from '@nestjs/common';
import { PassportModule } from "@nestjs/passport";
import { JwtStrategy } from "./jwt.strategy";
import { AuthRepository } from './auth.repository';

@Module({
    imports: [PassportModule],
    providers: [JwtStrategy, AuthRepository],
})
export class AuthModule { }