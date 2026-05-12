import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { AuthRepository } from "./auth.repository";
import { db } from "../database/drizzle";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(private readonly authRepository: AuthRepository) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            secretOrKey: process.env.TOKEN_KEY ?? '',
        });
    }

    async validate(payload: any) {
        const user = await this.authRepository.getUserByIdEmail(db, payload.idUser, payload.email);
        
        if (!user) {
            throw new UnauthorizedException('User not valid');
        }
        return payload;
    }
}