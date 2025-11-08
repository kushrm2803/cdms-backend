import { Injectable, Logger } from '@nestjs/common';
import { FabricService } from '../records/fabric.service';

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);
  constructor(private readonly fabricService: FabricService) {}

  async getOrganizations() {
    this.logger.log('Getting all organizations');
    const result = await this.fabricService.queryAllOrganizations('Org1MSP');
    // Depending on use, you may pass Org1MSP/Org2MSP based on caller
    return JSON.parse(result);
  }

  async getOrgMembers(orgId: string) {
    this.logger.log(`Getting members for org ${orgId}`);
    const result = await this.fabricService.queryOrganizationMembers(orgId, 'Org1MSP');
    return JSON.parse(result);
  }
}
