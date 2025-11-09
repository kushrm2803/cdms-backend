import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { FabricService } from '../records/fabric.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(private readonly jwtService: JwtService, private readonly fabricService: FabricService) {}

  async validateUser(username: string, password: string) {
    this.logger.log(`Validating user ${username}`);
    const userJson = await this.fabricService.queryUser(username, 'Org1MSP');
    if (!userJson) return null;
    const user = JSON.parse(userJson);
    // user.passwordHash expected to be stored by chaincode
    const match = await bcrypt.compare(password, user.passwordHash || user.password);
    if (match) {
      // strip sensitive fields
      const { passwordHash, password, ...safe } = user;
      return safe;
    }
    return null;
  }

  async login(user: any) {
    // Include 'organization' claim (canonical) so downstream code can read req.user.organization
    const payload = { username: user.username, sub: user.username, role: user.role, organization: user.organization || user.organizationId };
    return { accessToken: this.jwtService.sign(payload) };
  }
}
