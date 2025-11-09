import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { FabricService } from '../records/fabric.service';

type OrgMspId = 'Org1MSP' | 'Org2MSP';

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);
  constructor(private readonly fabricService: FabricService) {}

  /**
   * Get all organizations with optional role-based filtering
   */
  async getOrganizations(requestingOrgMspId: OrgMspId, userRole?: string) {
    this.logger.log(`Getting all organizations as ${requestingOrgMspId} with role ${userRole}`);
    
    try {
      const result = await this.fabricService.queryAllOrganizations(requestingOrgMspId);
      const organizations = JSON.parse(result);

      if (!Array.isArray(organizations)) {
        throw new Error('Invalid organizations data structure');
      }

      // Filter organizations based on user role if needed
      if (userRole && userRole !== 'admin') {
        return organizations.filter(org => {
          // Add role-based filtering logic here based on your requirements
          // For example, investigators might only see their own org
          return true; // Modify based on your access control rules
        });
      }

      return organizations;
    } catch (error) {
      this.logger.error('Failed to retrieve organizations:', error);
      throw new BadRequestException('Failed to retrieve organizations: ' + error.message);
    }
  }

  /**
   * Get members of a specific organization with role-based access control
   */
  async getOrgMembers(
    orgId: string, 
    requestingOrgMspId: OrgMspId,
    userRole: string,
    userOrg: string
  ) {
    this.logger.log(`Getting members for org ${orgId} as ${requestingOrgMspId}`);

    try {
      // Validate access based on role
      if (userRole !== 'admin' && userOrg !== orgId) {
        throw new Error('Access denied: You can only view members of your own organization');
      }

      const result = await this.fabricService.queryOrganizationMembers(orgId, requestingOrgMspId);
      const members = JSON.parse(result);

      if (!Array.isArray(members)) {
        throw new Error('Invalid organization members data structure');
      }

      // Filter sensitive information based on role
      const sanitizedMembers = members.map(member => {
        if (userRole === 'admin') {
          return member; // Admins see everything
        }
        // Remove sensitive fields for non-admin users
        const { password, ...sanitized } = member;
        return sanitized;
      });

      return sanitizedMembers;
    } catch (error) {
      if (error.message?.includes('not found')) {
        throw new NotFoundException(`Organization ${orgId} not found`);
      }
      this.logger.error(`Failed to retrieve members for org ${orgId}:`, error);
      throw new BadRequestException('Failed to retrieve organization members: ' + error.message);
    }
  }

  /**
   * Validate if the user has access to the organization
   */
  async validateOrgAccess(
    orgId: string,
    requestingOrgMspId: OrgMspId,
    userRole: string,
    userOrg: string
  ): Promise<boolean> {
    // Admins have access to all orgs
    if (userRole === 'admin') {
      return true;
    }

    try {
      const org = await this.fabricService.queryOrganizationMembers(orgId, requestingOrgMspId);
      const orgData = JSON.parse(org);

      // Check if user belongs to the org
      if (userOrg === orgId) {
        return true;
      }

      // Add additional access rules here based on your requirements
      
      return false;
    } catch (error) {
      this.logger.error(`Failed to validate org access for ${orgId}:`, error);
      return false;
    }
  }
}
