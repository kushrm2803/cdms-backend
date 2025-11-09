import { IsOptional, IsString, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';
import { normalizeRecordType, normalizeOrgMspId } from '../../utils/normalizers';

export class SearchRecordsDto {
  @IsOptional()
  @IsString()
  caseId?: string;

  @IsOptional()
  @IsOptional()
  @Transform(({ value }) => normalizeRecordType(value))
  @IsString()
  recordType?: string;

  @IsOptional()
  @IsString()
  uploaderId?: string;

  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;

  @IsEnum(['Org1MSP', 'Org2MSP'])
  @Transform(({ value }) => normalizeOrgMspId(value))
  orgMspId: 'Org1MSP' | 'Org2MSP';
}