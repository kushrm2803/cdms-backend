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
import { normalizeOrgMspId } from '../utils/normalizers';
import { CreatePolicyDto } from './dto/create-policy';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

type OrgMspId = 'Org1MSP' | 'Org2MSP';

@Controller('policies')
@UseGuards(JwtAuthGuard) // Protect all routes with JWT auth
export class PoliciesController {
  constructor(private readonly policiesService: PoliciesService) {}

  /**
   * POST /policies?org=Org1MSP
   * Creates a new policy with role-based access control (allowed orgs and roles).
   * Requires admin role to create policies.
   */
  @Post()
  async createPolicy(
    @Body() createPolicyDto: CreatePolicyDto,
    @Query('org') orgMspId: OrgMspId,
    @Req() req: RequestWithUser, // To access user claims from JWT
  ) {
    // Allow org to be supplied either via query param or JWT claim
    const callerOrgRaw = orgMspId || req.user?.organization;
    const callerOrg = normalizeOrgMspId(callerOrgRaw);
    if (!callerOrg) {
      throw new BadRequestException('Organization MSP ID (?org=...) is required.');
    }

    // Only admins can create policies
    if (req.user?.role !== 'admin') {
      throw new UnauthorizedException('Only administrators can create policies.');
    }

    // Validate allowed arrays
    if (!createPolicyDto.allowedOrgs || createPolicyDto.allowedOrgs.length === 0) {
      throw new BadRequestException('Policy must have at least one allowedOrg.');
    }
    if (!createPolicyDto.allowedRoles || createPolicyDto.allowedRoles.length === 0) {
      throw new BadRequestException('Policy must have at least one allowedRole.');
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
    const callerOrgRaw = orgMspId || req.user?.organization;
    const callerOrg = normalizeOrgMspId(callerOrgRaw);
    if (!callerOrg) {
      throw new BadRequestException('Organization MSP ID (?org=...) is required.');
    }

    const policies = await this.policiesService.getAllPolicies(callerOrg as OrgMspId);

    if (!req.user) {
      throw new UnauthorizedException('User is not authenticated');
    }

    // Filter policies based on user's role and organization (defensive checks)
    return policies.filter(policy => {
      if (!policy) return false;
      const allowedOrgs = policy.allowedOrgs || policy.AllowedOrgs || [];
      const allowedRoles = policy.allowedRoles || policy.AllowedRoles || [];

      const orgOk = allowedOrgs.length === 0 || allowedOrgs.includes(req.user!.organization);
      const roleOk = allowedRoles.length === 0 || (Array.isArray(allowedRoles) && allowedRoles.includes(req.user!.role));

      return orgOk && roleOk;
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
    const callerOrgRaw = orgMspId || req.user?.organization;
    const callerOrg = normalizeOrgMspId(callerOrgRaw);
    if (!callerOrg) {
      throw new BadRequestException('Organization MSP ID (?org=...) is required.');
    }

    try {
      const policy = await this.policiesService.getPolicy(id, callerOrg as OrgMspId);

      if (!req.user) {
        throw new UnauthorizedException('User is not authenticated');
      }


      // Defensive access checks
      if (!policy) {
        throw new NotFoundException(`Policy ${id} not found.`);
      }

      const allowedOrgs = policy.allowedOrgs || policy.AllowedOrgs || [];
      const allowedRoles = policy.allowedRoles || policy.AllowedRoles || [];

      const orgOk = allowedOrgs.length === 0 || allowedOrgs.includes(req.user!.organization);
      const roleOk = allowedRoles.length === 0 || (Array.isArray(allowedRoles) && allowedRoles.includes(req.user!.role));

      const hasAccess = orgOk && roleOk;

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