import { Injectable, Logger } from '@nestjs/common';
import { FabricService } from '../records/fabric.service';
import { CreatePolicyDto } from './dto/create-policy';

type OrgMspId = 'Org1MSP' | 'Org2MSP';

@Injectable()
export class PoliciesService {
  private readonly logger = new Logger(PoliciesService.name);
  constructor(private readonly fabricService: FabricService) {}

  /**
   * Creates a new policy with role-based access rules
   */
  async createPolicy(
    createPolicyDto: CreatePolicyDto,
    orgMspId: OrgMspId,
  ) {
    this.logger.log(
      `Creating policy ${createPolicyDto.policyId} as ${orgMspId}`,
    );

    // Validate rules first
    this.validatePolicyRules(createPolicyDto.rules);

    // Normalize rules before sending to Fabric
    //    Ensures each rule always has both 'allow' and 'deny' keys (required by chaincode)
    const normalizedRules = createPolicyDto.rules.map(rule => ({
      allow: rule.allow || {},
      deny: rule.deny || {},
    }));

    const categoriesJSON = JSON.stringify(createPolicyDto.categories);
    const rulesJSON = JSON.stringify(normalizedRules);

    await this.fabricService.createPolicy(
      createPolicyDto.policyId,
      categoriesJSON,
      rulesJSON,
      orgMspId,
    );

    return {
      message: 'Policy created successfully',
      policyId: createPolicyDto.policyId,
      categories: createPolicyDto.categories,
      rules: normalizedRules, // return normalized rules too
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

  /**
   * Validates policy rules structure and logic
   */
  private validatePolicyRules(rules: any[]) {
    if (!Array.isArray(rules) || rules.length === 0) {
      throw new Error('Policy must have at least one rule');
    }

    for (const rule of rules) {
      // At least one of allow/deny must be present
      if (!rule.allow && !rule.deny) {
        throw new Error('Each rule must have either allow or deny conditions');
      }

      // Validate allow rules
      if (rule.allow) {
        this.validateRuleConditions(rule.allow, 'allow');
      }

      // Validate deny rules
      if (rule.deny) {
        this.validateRuleConditions(rule.deny, 'deny');
      }

      // Check for conflicting rules
      if (rule.allow && rule.deny) {
        this.checkConflictingRules(rule.allow, rule.deny);
      }
    }
  }

  /**
   * Validates individual rule conditions
   */
  private validateRuleConditions(condition: any, type: 'allow' | 'deny') {
    // Organization check
    if (condition.org && typeof condition.org !== 'string') {
      throw new Error(`${type} org must be a string`);
    }

    // Role check
    if (condition.role) {
      // Auto-wrap single role string into an array for user convenience
      if (typeof condition.role === 'string') {
        condition.role = [condition.role];
      } else if (!Array.isArray(condition.role) ||
        !condition.role.every(r => typeof r === 'string')) {
        throw new Error(`${type} roles must be an array of strings`);
      }
    }

    // User check
    if (condition.user) {
      if (typeof condition.user === 'string') {
        condition.user = [condition.user];
      } else if (!Array.isArray(condition.user) ||
        !condition.user.every(u => typeof u === 'string')) {
        throw new Error(`${type} users must be an array of strings`);
      }
    }
  }

  /**
   * Checks for conflicting allow/deny rules
   */
  private checkConflictingRules(allow: any, deny: any) {
    if (allow.org && deny.org && allow.org === deny.org) {
      throw new Error('Cannot allow and deny the same organization');
    }

    if (allow.role && deny.role) {
      const conflicts = allow.role.filter(r => deny.role.includes(r));
      if (conflicts.length > 0) {
        throw new Error(`Cannot allow and deny the same roles: ${conflicts.join(', ')}`);
      }
    }

    if (allow.user && deny.user) {
      const conflicts = allow.user.filter(u => deny.user.includes(u));
      if (conflicts.length > 0) {
        throw new Error(`Cannot allow and deny the same users: ${conflicts.join(', ')}`);
      }
    }
  }
}
