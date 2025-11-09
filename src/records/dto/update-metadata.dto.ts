import { IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { normalizeRecordType } from '../../utils/normalizers';

export class UpdateMetadataDto {
  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsOptional()
  @Transform(({ value }) => normalizeRecordType(value))
  @IsString()
  recordType?: string;

  @IsOptional()
  @IsString()
  policyId?: string;

  @IsOptional()
  @IsString()
  additionalInfo?: string;
}