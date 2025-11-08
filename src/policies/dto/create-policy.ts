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
  allow?: Record<string, string>;

  @IsObject()
  deny?: Record<string, string>;
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
  @ValidateNested({ each: true })
  @Type(() => RuleDto)
  rules: RuleDto[];
}