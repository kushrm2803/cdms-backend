import { Injectable, Logger } from '@nestjs/common';
import { FabricService } from '../records/fabric.service';
import { CreatePolicyDto } from './dto/create-policy';

type OrgMspId = 'Org1MSP' | 'Org2MSP';

@Injectable()
export class PoliciesService {
  private readonly logger = new Logger(PoliciesService.name);
  constructor(private readonly fabricService: FabricService) {}

  async createPolicy(
    createPolicyDto: CreatePolicyDto,
    orgMspId: OrgMspId,
  ) {
    this.logger.log(
      `Creating policy ${createPolicyDto.policyId} as ${orgMspId}`,
    );

    const categoriesJSON = JSON.stringify(createPolicyDto.categories);
    const rulesJSON = JSON.stringify(createPolicyDto.rules);

    await this.fabricService.createPolicy(
      createPolicyDto.policyId,
      categoriesJSON,
      rulesJSON,
      orgMspId,
    );

    return {
      message: 'Policy created successfully',
      policyId: createPolicyDto.policyId,
    };
  }

  async getAllPolicies(orgMspId: OrgMspId) {
    this.logger.log(`Getting all policies as ${orgMspId}`);
    const result = await this.fabricService.queryAllPolicies(orgMspId);
    return JSON.parse(result);
  }

  async getPolicy(id: string, orgMspId: OrgMspId) {
    this.logger.log(`Getting policy ${id} as ${orgMspId}`);
    const result = await this.fabricService.queryPolicy(id, orgMspId);
    return JSON.parse(result);
  }
}