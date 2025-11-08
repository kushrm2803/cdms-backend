import { Controller, Post, Get, Body, Param, Delete, Query } from '@nestjs/common';
import { CasesService } from './cases.service';
import { CreateCaseDto } from './dto/create-case.dto';

@Controller('cases')
export class CasesController {
  constructor(private readonly casesService: CasesService) {}

  @Post()
  createCase(
    @Body() createCaseDto: CreateCaseDto,
    @Query('org') orgMspId: 'Org1MSP' | 'Org2MSP'
  ) {
    return this.casesService.createCase(createCaseDto, orgMspId);
  }

  @Get()
  getAllCases(
    @Query('org') orgMspId: 'Org1MSP' | 'Org2MSP',
    @Query('status') status?: string,
    @Query('jurisdiction') jurisdiction?: string
  ) {
    return this.casesService.getAllCases(orgMspId, { status, jurisdiction });
  }

  @Get(':id')
  getCase(
    @Param('id') id: string,
    @Query('org') orgMspId: 'Org1MSP' | 'Org2MSP'
  ) {
    return this.casesService.getCase(id, orgMspId);
  }

  @Delete(':id')
  deleteCase(
    @Param('id') id: string,
    @Query('org') orgMspId: 'Org1MSP' | 'Org2MSP'
  ) {
    return this.casesService.deleteCase(id, orgMspId);
  }
}