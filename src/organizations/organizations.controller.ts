import { 
  Controller, 
  Get, 
  Param, 
  Query, 
  UseGuards, 
  Request,
  BadRequestException,
  UnauthorizedException
} from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { normalizeOrgMspId } from '../utils/normalizers';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

type OrgMspId = 'Org1MSP' | 'Org2MSP';

@Controller('organizations')
@UseGuards(JwtAuthGuard)
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  /**
   * GET /organizations?org=Org1MSP
   * Lists all organizations accessible to the user
   */
  @Get()
  async getOrganizations(
    @Query('org') orgMspId: OrgMspId,
    @Request() req: any,
  ) {
    const org = normalizeOrgMspId(orgMspId);
    if (!org) {
      throw new BadRequestException('Organization MSP ID (?org=...) is required.');
    }

    // Get user info from JWT
    const { role, organization: userOrg } = req.user;

    return this.organizationsService.getOrganizations(
      org as 'Org1MSP' | 'Org2MSP',
      role
    );
  }

  /**
   * GET /organizations/:orgId/members?org=Org1MSP
   * Gets members of a specific organization
   * Access controls:
   * - Admins can view all org members
   * - Users can only view members of their own org
   */
  @Get(':orgId/members')
  async getOrgMembers(
    @Param('orgId') orgId: string,
    @Query('org') orgMspId: OrgMspId,
    @Request() req: any,
  ) {
    const org = normalizeOrgMspId(orgMspId);
    if (!org) {
      throw new BadRequestException('Organization MSP ID (?org=...) is required.');
    }

    // Get user info from JWT
    const { role, organization: userOrg } = req.user;

    // Verify access rights
    const hasAccess = await this.organizationsService.validateOrgAccess(
      orgId,
      org as 'Org1MSP' | 'Org2MSP',
      role,
      userOrg
    );

    if (!hasAccess) {
      throw new UnauthorizedException(
        'You do not have permission to view members of this organization.'
      );
    }

    return this.organizationsService.getOrgMembers(
      orgId,
      org as 'Org1MSP' | 'Org2MSP',
      role,
      userOrg
    );
  }
}