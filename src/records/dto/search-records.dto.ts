import { IsOptional, IsString, IsEnum } from 'class-validator';

export class SearchRecordsDto {
  @IsOptional()
  @IsString()
  caseId?: string;

  @IsOptional()
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
  orgMspId: 'Org1MSP' | 'Org2MSP';
}