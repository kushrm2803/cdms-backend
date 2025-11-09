import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { FabricService } from '../records/fabric.service';
import { CreateCaseDto } from './dto/create-case.dto';
import { v4 as uuid } from 'uuid';

@Injectable()
export class CasesService {
  private readonly logger = new Logger(CasesService.name);
  constructor(private readonly fabricService: FabricService) {}

  async createCase(createCaseDto: CreateCaseDto, orgMspId: 'Org1MSP' | 'Org2MSP') {
    const id = `case-${uuid()}`;
    this.logger.log(`Creating case ${id} as ${orgMspId}`);
    await this.fabricService.createCase(
      id,
      createCaseDto.title,
      createCaseDto.description,
      createCaseDto.jurisdiction,
      createCaseDto.caseType,
      createCaseDto.policyId || '',  // Empty string if no policy provided
      orgMspId,
    );
    return { message: 'Case created', caseId: id };
  }

  async getAllCases(
    orgMspId: 'Org1MSP' | 'Org2MSP', 
    userRole: string,
    filters: { status?: string; jurisdiction?: string }
  ) {
    this.logger.log(`Getting cases as ${orgMspId} role ${userRole} with filters ${JSON.stringify(filters)}`);
    try {
      const result = await this.fabricService.queryAllCases(JSON.stringify(filters), userRole, orgMspId);
      
      // Handle empty results
      if (!result || result.trim() === '') {
        this.logger.log('No cases found or access denied');
        return [];
      }
      
      try {
        return JSON.parse(result);
      } catch (parseError) {
        this.logger.error('Failed to parse cases result:', parseError);
        return [];
      }
    } catch (error) {
      this.logger.error('Error retrieving cases:', error);
      // Return empty array instead of throwing error for better user experience
      return [];
    }
  }

  async getCase(id: string, orgMspId: 'Org1MSP' | 'Org2MSP', userRole: string) {
    this.logger.log(`Getting case ${id} as ${orgMspId} role ${userRole}`);
    try {
      const result = await this.fabricService.queryCase(id, userRole, orgMspId);
      
      if (!result || result.trim() === '') {
        throw new NotFoundException(`Case ${id} not found or access denied`);
      }
      
      try {
        return JSON.parse(result);
      } catch (parseError) {
        this.logger.error('Failed to parse case result:', parseError);
        throw new NotFoundException(`Invalid case data for ${id}`);
      }
    } catch (error) {
      this.logger.error(`Error retrieving case ${id}:`, error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new NotFoundException(`Case ${id} not found or access denied`);
    }
  }

  async deleteCase(id: string, orgMspId: 'Org1MSP' | 'Org2MSP') {
    this.logger.log(`Deleting case ${id} as ${orgMspId}`);
    await this.fabricService.deleteCase(id, orgMspId);
    return { message: 'Case deleted' };
  }

  async verifyPolicy(policyId: string, orgMspId: 'Org1MSP' | 'Org2MSP', userRole: string) {
    try {
      this.logger.log(`Verifying policy ${policyId} for role ${userRole} as ${orgMspId}`);
      const policy = await this.fabricService.queryPolicy(policyId, orgMspId);
      if (!policy) {
        throw new NotFoundException(`Policy ${policyId} not found`);
      }

      const policyObj = JSON.parse(policy);
      // Check if the user's role is allowed in the policy
      if (!policyObj.allowedRoles.includes(userRole)) {
        this.logger.warn(`Access denied: Role ${userRole} not allowed in policy ${policyId}`);
        return null;
      }

      // Check if the user's organization is allowed
      if (!policyObj.allowedOrgs.includes(orgMspId)) {
        this.logger.warn(`Access denied: Organization ${orgMspId} not allowed in policy ${policyId}`);
        return null;
      }

      return policyObj;
    } catch (error) {
      this.logger.error(`Error verifying policy: ${error.message}`);
      throw error;
    }
  }
}
