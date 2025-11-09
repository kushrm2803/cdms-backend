import { IsString, IsEmail, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';
import { normalizeRole, normalizeOrgMspId } from '../../utils/normalizers';

export class CreateUserDto {
  @IsString()
  username: string;

  @IsEmail()
  email: string;

  @IsString()
  password: string;

  @IsString()
  fullName: string;

  @Transform(({ value }) => normalizeRole(value))
  @IsEnum(['investigator', 'admin', 'forensics', 'judge'])
  role: string;

  @Transform(({ value }) => normalizeOrgMspId(value))
  @IsString()
  organizationId: string;
}