import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'replace_this_secret',
    });
  }

  async validate(payload: any) {
    // payload contains username, role, organization
    // Map JWT payload to the Request user object used across controllers (username, role, organization)
    return { username: payload.username, role: payload.role, organization: payload.organization };
  }
}
