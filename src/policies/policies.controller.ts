import {
  Controller,
  Get,
  Param,
  Query,
  Post,
  Body,
  UseGuards,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';

interface RequestWithUser extends Request {
  user?: {
    role: string;
    organization: string;
    id: string;
  };
}
import { PoliciesService } from './policies.service';
import { CreatePolicyDto } from './dto/create-policy';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

type OrgMspId = 'Org1MSP' | 'Org2MSP';

@Controller('policies')
@UseGuards(JwtAuthGuard) // Protect all routes with JWT auth
export class PoliciesController {
  constructor(private readonly policiesService: PoliciesService) {}

  /**
   * POST /policies?org=Org1MSP
   * Creates a new policy with role-based access rules.
   * Requires admin role to create policies.
   */
  @Post()
  async createPolicy(
    @Body() createPolicyDto: CreatePolicyDto,
    @Query('org') orgMspId: OrgMspId,
    @Req() req: RequestWithUser, // To access user claims from JWT
  ) {
    // Allow org to be supplied either via query param or JWT claim
    const callerOrg = orgMspId || req.user?.organization;
    if (!callerOrg) {
      throw new BadRequestException('Organization MSP ID (?org=...) is required.');
    }

    // Only admins can create policies
    if (req.user?.role !== 'admin') {
      throw new UnauthorizedException('Only administrators can create policies.');
    }

    // Validate policy rules
    if (!createPolicyDto.rules || createPolicyDto.rules.length === 0) {
      throw new BadRequestException('Policy must have at least one access rule.');
    }

    try {
      return await this.policiesService.createPolicy(createPolicyDto, callerOrg as OrgMspId);
    } catch (error) {
      if (error.message?.includes('already exists')) {
        throw new BadRequestException(`Policy ${createPolicyDto.policyId} already exists.`);
      }
      throw error;
    }
  }

  /**
   * GET /policies?org=Org1MSP
   * Lists all accessible policies for the current user's role.
   * Filters policies based on user's organization and role.
   */
  @Get()
  async getAllPolicies(
    @Query('org') orgMspId: OrgMspId,
    @Req() req: RequestWithUser,
  ) {
    // Allow org from query or JWT
    const callerOrg = orgMspId || req.user?.organization;
    if (!callerOrg) {
      throw new BadRequestException('Organization MSP ID (?org=...) is required.');
    }

    const policies = await this.policiesService.getAllPolicies(callerOrg as OrgMspId);

    if (!req.user) {
      throw new UnauthorizedException('User is not authenticated');
    }

    // Filter policies based on user's role and organization (defensive checks)
    return policies.filter(policy => {
      if (!policy || !Array.isArray(policy.rules)) return false;
      return policy.rules.some(rule => {
        const allow = rule.allow || {};
        const deny = rule.deny || {};

        const allowOrgOk = !allow.org || allow.org === req.user!.organization;
        const allowRoleOk = !allow.role || (Array.isArray(allow.role) && allow.role.includes(req.user!.role));
        const denyOrgBad = deny.org && deny.org === req.user!.organization;
        const denyRoleBad = deny.role && Array.isArray(deny.role) && deny.role.includes(req.user!.role);

        return allowOrgOk && allowRoleOk && !denyOrgBad && !denyRoleBad;
      });
    });
  }

  /**
   * GET /policies/:id?org=Org1MSP
   * Gets a specific policy if the user has access to it.
   */
  @Get(':id')
  async getPolicy(
    @Param('id') id: string,
    @Query('org') orgMspId: OrgMspId,
    @Req() req: RequestWithUser,
  ) {
    // Allow org from query or JWT
    const callerOrg = orgMspId || req.user?.organization;
    if (!callerOrg) {
      throw new BadRequestException('Organization MSP ID (?org=...) is required.');
    }

    try {
      const policy = await this.policiesService.getPolicy(id, callerOrg as OrgMspId);

      if (!req.user) {
        throw new UnauthorizedException('User is not authenticated');
      }

      // Defensive access checks
      if (!policy || !Array.isArray(policy.rules)) {
        throw new NotFoundException(`Policy ${id} not found.`);
      }

      const hasAccess = policy.rules.some(rule => {
        const allow = rule.allow || {};
        const deny = rule.deny || {};

        const allowOrgOk = !allow.org || allow.org === req.user!.organization;
        const allowRoleOk = !allow.role || (Array.isArray(allow.role) && allow.role.includes(req.user!.role));
        const denyOrgBad = deny.org && deny.org === req.user!.organization;
        const denyRoleBad = deny.role && Array.isArray(deny.role) && deny.role.includes(req.user!.role);

        return allowOrgOk && allowRoleOk && !denyOrgBad && !denyRoleBad;
      });

      if (!hasAccess) {
        throw new UnauthorizedException('You do not have access to this policy.');
      }

      return policy;
    } catch (error) {
      if (error.message?.includes('not found')) {
        throw new NotFoundException(`Policy ${id} not found.`);
      }
      throw error;
    }
  }
}