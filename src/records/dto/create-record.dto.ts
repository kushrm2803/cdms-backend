export class CreateRecordDto {
  caseId: string;
  recordType: 'FIR' | 'Evidence' | 'Report' | 'WitnessStatement';
  description?: string; // Optional field
  policyId?: string;
}