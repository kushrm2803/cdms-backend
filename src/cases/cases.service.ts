import { Injectable, Logger } from '@nestjs/common';
import { FabricService } from '../records/fabric.service';
import { CreateCaseDto } from './dto/create-case.dto';
import { v4 as uuid } from 'uuid';

@Injectable()
export class CasesService {
  private readonly logger = new Logger(CasesService.name);
  constructor(private readonly fabricService: FabricService) {}

  async createCase(createCaseDto: CreateCaseDto, orgMspId: 'Org1MSP' | 'Org2MSP') {
    const id = `case-${uuid()}`;
    this.logger.log(`Creating case ${id} as ${orgMspId}`);
    await this.fabricService.createCase(
      id,
      createCaseDto.title,
      createCaseDto.description,
      createCaseDto.jurisdiction,
      createCaseDto.caseType,
      orgMspId,
    );
    return { message: 'Case created', caseId: id };
  }

  async getAllCases(orgMspId: 'Org1MSP' | 'Org2MSP', filters: { status?: string; jurisdiction?: string }) {
    this.logger.log(`Getting cases as ${orgMspId} with filters ${JSON.stringify(filters)}`);
    const result = await this.fabricService.queryAllCases(JSON.stringify(filters), orgMspId);
    return JSON.parse(result);
  }

  async getCase(id: string, orgMspId: 'Org1MSP' | 'Org2MSP') {
    this.logger.log(`Getting case ${id} as ${orgMspId}`);
    const result = await this.fabricService.queryCase(id, orgMspId);
    return JSON.parse(result);
  }

  async deleteCase(id: string, orgMspId: 'Org1MSP' | 'Org2MSP') {
    this.logger.log(`Deleting case ${id} as ${orgMspId}`);
    await this.fabricService.deleteCase(id, orgMspId);
    return { message: 'Case deleted' };
  }
}
