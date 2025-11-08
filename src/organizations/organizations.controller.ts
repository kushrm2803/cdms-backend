import { Controller, Get, Param } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';

@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get()
  getOrganizations() {
    return this.organizationsService.getOrganizations();
  }

  @Get(':orgId/members')
  getOrgMembers(@Param('orgId') orgId: string) {
    return this.organizationsService.getOrgMembers(orgId);
  }
}