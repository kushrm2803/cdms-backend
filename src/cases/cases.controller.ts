import { Controller, Post, Get, Body, Param, Delete, Query } from '@nestjs/common';
import { CasesService } from './cases.service';
import { CreateCaseDto } from './dto/create-case.dto';
import { normalizeOrgMspId } from '../utils/normalizers';

@Controller('cases')
export class CasesController {
  constructor(private readonly casesService: CasesService) {}

  @Post()
  createCase(
    @Body() createCaseDto: CreateCaseDto,
    @Query('org') orgMspId: string
  ) {
    const org = normalizeOrgMspId(orgMspId);
    return this.casesService.createCase(createCaseDto, org as 'Org1MSP' | 'Org2MSP');
  }

  @Get()
  getAllCases(
    @Query('org') orgMspId: string,
    @Query('status') status?: string,
    @Query('jurisdiction') jurisdiction?: string
  ) {
    const org = normalizeOrgMspId(orgMspId);
    return this.casesService.getAllCases(org as 'Org1MSP' | 'Org2MSP', { status, jurisdiction });
  }

  @Get(':id')
  getCase(
    @Param('id') id: string,
    @Query('org') orgMspId: string
  ) {
    const org = normalizeOrgMspId(orgMspId);
    return this.casesService.getCase(id, org as 'Org1MSP' | 'Org2MSP');
  }

  @Delete(':id')
  deleteCase(
    @Param('id') id: string,
    @Query('org') orgMspId: string
  ) {
    const org = normalizeOrgMspId(orgMspId);
    return this.casesService.deleteCase(id, org as 'Org1MSP' | 'Org2MSP');
  }
}