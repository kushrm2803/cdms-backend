import { Injectable, Logger } from '@nestjs/common';
import { FabricService } from '../records/fabric.service';
import { CreatePolicyDto } from './dto/create-policy';

type OrgMspId = 'Org1MSP' | 'Org2MSP';

@Injectable()
export class PoliciesService {
  private readonly logger = new Logger(PoliciesService.name);
  constructor(private readonly fabricService: FabricService) {}

  /**
   * Creates a new policy with role-based access control (allowed orgs and roles)
   */
  async createPolicy(
    createPolicyDto: CreatePolicyDto,
    orgMspId: OrgMspId,
  ) {
    this.logger.log(
      `Creating policy ${createPolicyDto.policyId} as ${orgMspId}`,
    );
    // Validate allowed arrays
    if (!Array.isArray(createPolicyDto.allowedOrgs) || createPolicyDto.allowedOrgs.length === 0) {
      throw new Error('Policy must define at least one allowedOrg');
    }
    if (!Array.isArray(createPolicyDto.allowedRoles) || createPolicyDto.allowedRoles.length === 0) {
      throw new Error('Policy must define at least one allowedRole');
    }

    const categoriesJSON = JSON.stringify(createPolicyDto.categories);
    const allowedOrgsJSON = JSON.stringify(createPolicyDto.allowedOrgs);
    const allowedRolesJSON = JSON.stringify(createPolicyDto.allowedRoles);

    await this.fabricService.createPolicy(
      createPolicyDto.policyId,
      categoriesJSON,
      allowedOrgsJSON,
      allowedRolesJSON,
      orgMspId,
    );

    return {
      message: 'Policy created successfully',
      policyId: createPolicyDto.policyId,
      categories: createPolicyDto.categories,
      allowedOrgs: createPolicyDto.allowedOrgs,
      allowedRoles: createPolicyDto.allowedRoles,
    };
  }

  /**
   * Retrieves all policies, already filtered by chaincode based on org
   */
  async getAllPolicies(orgMspId: OrgMspId) {
    this.logger.log(`Getting all policies as ${orgMspId}`);
    const result = await this.fabricService.queryAllPolicies(orgMspId);
    
    try {
      if (!result || (typeof result === 'string' && result.trim() === '')) {
        this.logger.debug('QueryAllPolicies returned empty result; returning empty array.');
        return [];
      }

      let policies: any;
      if (typeof result === 'string') {
        policies = JSON.parse(result);
      } else {
        policies = result;
      }

      if (!Array.isArray(policies)) {
        if (policies && Array.isArray(policies.policies)) {
          policies = policies.policies;
        } else {
          throw new Error('Invalid policies data structure');
        }
      }

      return policies;
    } catch (error) {
      this.logger.error('Failed to parse policies. Raw result:', result);
      this.logger.error('Parse error:', error);
      throw new Error('Failed to retrieve policies. Invalid data structure.');
    }
  }

  /**
   * Retrieves a specific policy by ID
   */
  async getPolicy(id: string, orgMspId: OrgMspId) {
    this.logger.log(`Getting policy ${id} as ${orgMspId}`);
    const result = await this.fabricService.queryPolicy(id, orgMspId);
    
    try {
      const policy = JSON.parse(result);
      if (!policy || !policy.policyId) {
        throw new Error('Policy not found');
      }
      return policy;
    } catch (error) {
      this.logger.error(`Failed to retrieve policy ${id}:`, error);
      throw new Error(`Failed to retrieve policy ${id}: ${error.message}`);
    }
  }
  // (old rule validation removed - using simplified allowed arrays)
}
