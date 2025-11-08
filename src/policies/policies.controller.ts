import {
  Controller,
  Get,
  Param,
  Query,
  Post,
  Body,
} from '@nestjs/common';
import { PoliciesService } from './policies.service';
import { CreatePolicyDto } from './dto/create-policy';

type OrgMspId = 'Org1MSP' | 'Org2MSP';

@Controller('policies')
export class PoliciesController {
  constructor(private readonly policiesService: PoliciesService) {}

  /**
   * NEW ROUTE: POST /policies?org=Org1MSP
   * Creates a new policy.
   */
  @Post()
  createPolicy(
    @Body() createPolicyDto: CreatePolicyDto, // Validate the body
    @Query('org') orgMspId: OrgMspId, // Get org from query param
  ) {
    if (!orgMspId) {
      throw new Error('Organization MSP ID (?org=...) is required.');
    }
    return this.policiesService.createPolicy(createPolicyDto, orgMspId);
  }

  /**
   * EXISTING ROUTE: GET /policies
   */
  @Get()
  getAllPolicies(@Query('org') orgMspId: OrgMspId) {
    return this.policiesService.getAllPolicies(orgMspId);
  }

  /**
   * EXISTING ROUTE: GET /policies/:id
   */
  @Get(':id')
  getPolicy(
    @Param('id') id: string,
    @Query('org') orgMspId: OrgMspId,
  ) {
    return this.policiesService.getPolicy(id, orgMspId);
  }
}