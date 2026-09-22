import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

export type Payload = {
    id: number;
    username: string;
    role: string;
};

@Injectable()
export class JWTStrategy extends PassportStrategy(Strategy) {
    constructor(private configService: ConfigService) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: configService.get<string>('JWT_SECRET') || process.env.JWT_SECRET || 'tablify_secret_key',
        });
    }

    async validate(payload: Payload) {
        return {
            id: payload.id,
            username: payload.username,
            role: payload.role,
        };
    }
}