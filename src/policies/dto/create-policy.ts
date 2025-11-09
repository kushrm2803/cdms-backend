import { Type } from 'class-transformer';
import {
  IsString,
  IsArray,
  IsObject,
  ValidateNested,
  IsNotEmpty,
} from 'class-validator';

// This defines the 'Rule' object
class RuleDto {
  @IsObject()
  allow?: {
    org?: string;
    role?: string[];
    user?: string[];
  };

  @IsObject()
  deny?: {
    org?: string;
    role?: string[];
    user?: string[];
  };
}

// This defines the main request body
export class CreatePolicyDto {
  @IsString()
  @IsNotEmpty()
  policyId: string;

  @IsArray()
  @IsString({ each: true })
  categories: string[];

  @IsArray()
  @IsString({ each: true })
  allowedOrgs: string[];

  @IsArray()
  @IsString({ each: true })
  allowedRoles: string[];
}