import { IsString, IsEmail, IsEnum } from 'class-validator';

export class CreateUserDto {
  @IsString()
  username: string;

  @IsEmail()
  email: string;

  @IsString()
  password: string;

  @IsString()
  fullName: string;

  @IsEnum(['Investigator', 'Admin', 'Forensics', 'Judge'])
  role: string;

  @IsString()
  organizationId: string;
}