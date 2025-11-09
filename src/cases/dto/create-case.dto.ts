import { IsString, IsOptional, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';
import { normalizeStatus } from '../../utils/normalizers';

export class CreateCaseDto {
  @IsString()
  title: string;

  @IsString()
  description: string;

  @Transform(({ value }) => normalizeStatus(value))
  @IsEnum(['Open', 'Closed', 'Under Investigation'])
  status: string;

  @IsString()
  jurisdiction: string;

  @IsString()
  caseType: string;

  @IsOptional()
  @IsString()
  additionalDetails?: string;

  @IsOptional()
  @IsString()
  policyId?: string;  // Optional policy ID to control access
}