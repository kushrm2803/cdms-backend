import { IsString, IsOptional, IsEnum } from 'class-validator';

export class CreateCaseDto {
  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsEnum(['Open', 'Closed', 'Under Investigation'])
  status: string;

  @IsString()
  jurisdiction: string;

  @IsString()
  caseType: string;

  @IsOptional()
  @IsString()
  additionalDetails?: string;
}