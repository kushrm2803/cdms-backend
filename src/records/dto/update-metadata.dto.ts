import { IsOptional, IsString } from 'class-validator';

export class UpdateMetadataDto {
  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  recordType?: string;

  @IsOptional()
  @IsString()
  policyId?: string;

  @IsOptional()
  @IsString()
  additionalInfo?: string;
}