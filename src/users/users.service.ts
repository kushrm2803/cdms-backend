import { Injectable, Logger } from '@nestjs/common';
import { FabricService } from '../records/fabric.service';
import { CreateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  constructor(private readonly fabricService: FabricService) {}

  async registerUser(createUserDto: CreateUserDto) {
    this.logger.log(`Registering user ${createUserDto.username}`);
    // For now, we call chaincode to persist user data; password handling must be added (hashing, vault)
    // Hash password before sending to chaincode
    const passwordHash = await bcrypt.hash(createUserDto.password, 10);
    // Use provided organizationId or default to Org1MSP
    const org = createUserDto.organizationId || 'Org1MSP';
    if (!createUserDto.organizationId) {
      this.logger.warn(`No organizationId provided for user ${createUserDto.username}; defaulting to ${org}`);
    }

    await this.fabricService.createUser(
      createUserDto.username,
      createUserDto.fullName,
      createUserDto.email,
      createUserDto.role,
      org,
      passwordHash,
      'Org1MSP',
    );
    return { message: 'User registration submitted to blockchain' };
  }

  async login(loginDto: { username: string; password: string }) {
    this.logger.log(`Login attempt for ${loginDto.username}`);
    // This method is kept as a fallback; prefer using AuthService.login
    const userJson = await this.fabricService.queryUser(loginDto.username, 'Org1MSP');
    const user = userJson ? JSON.parse(userJson) : null;
    if (!user) {
      return { message: 'Invalid credentials' };
    }
    const match = await bcrypt.compare(loginDto.password, user.passwordHash || user.password);
    if (!match) return { message: 'Invalid credentials' };
    // Do not issue token here; AuthService will be used by controller
    return { message: 'Credentials valid', user };
  }

  async getProfile(username: string) {
    this.logger.log(`Getting profile for ${username}`);
    const userJson = await this.fabricService.queryUser(username, 'Org1MSP');
    return JSON.parse(userJson);
  }
}
