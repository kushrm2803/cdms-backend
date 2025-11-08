import { IsString, IsNotEmpty, IsIn, IsOptional } from 'class-validator';

// This is the list of valid organization MSP IDs
const validOrgMsps = ['Org1MSP', 'Org2MSP'];

// This is the list of valid record types from your error message
const validRecordTypes = ['FIR', 'Evidence', 'Report', 'WitnessStatement'];

export class CreateRecordDto {
  @IsString()
  @IsNotEmpty()
  caseId: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(validRecordTypes) // Use the specific types
  recordType: 'FIR' | 'Evidence' | 'Report' | 'WitnessStatement';

  @IsString()
  @IsNotEmpty()
  @IsIn(validOrgMsps) // Ensure it's one of the valid MSPs
  ownerOrg: 'Org1MSP' | 'Org2MSP'; // <-- ADDED THIS REQUIRED FIELD

  @IsString()
  @IsOptional() // This was optional in your version
  description?: string;

  @IsString()
  @IsOptional() // This was in your version
  policyId?: string;
}