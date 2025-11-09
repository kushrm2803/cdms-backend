import { Controller, Post, Get, Body, Param, Delete, Query, Req, UseGuards, BadRequestException } from '@nestjs/common';
import { CasesService } from './cases.service';
import { CreateCaseDto } from './dto/create-case.dto';
import { normalizeOrgMspId } from '../utils/normalizers';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { Request } from 'express';

@Controller('cases')
@UseGuards(JwtAuthGuard)
export class CasesController {
  constructor(private readonly casesService: CasesService) {}

  @Post()
  async createCase(
    @Body() createCaseDto: CreateCaseDto,
    @Query('org') orgMspId: string,
    @Req() req: Request & { user: { role: string } }
  ) {
    const org = normalizeOrgMspId(orgMspId);
    if (!org) {
      throw new BadRequestException('Organization MSP ID (?org=...) is required.');
    }

    // If a policy is specified, verify it exists and user has access
    if (createCaseDto.policyId) {
      try {
        const { role } = req.user;
        const policy = await this.casesService.verifyPolicy(
          createCaseDto.policyId,
          org as 'Org1MSP' | 'Org2MSP',
          role
        );
        if (!policy) {
          throw new BadRequestException(`Policy ${createCaseDto.policyId} not found or access denied`);
        }
      } catch (error) {
        throw new BadRequestException(`Invalid policy: ${error.message}`);
      }
    }

    return this.casesService.createCase(createCaseDto, org as 'Org1MSP' | 'Org2MSP');
  }

  @Get()
  getAllCases(
    @Req() req: Request & { user: { role: string } },
    @Query('org') orgMspId: string,
    @Query('status') status?: string,
    @Query('jurisdiction') jurisdiction?: string,
  ) {
    const org = normalizeOrgMspId(orgMspId);
    const { role } = req.user;
    return this.casesService.getAllCases(
      org as 'Org1MSP' | 'Org2MSP', 
      role,
      { status, jurisdiction }
    );
  }

  @Get(':id')
  getCase(
    @Param('id') id: string,
    @Query('org') orgMspId: string,
    @Req() req: Request & { user: { role: string } }
  ) {
    const org = normalizeOrgMspId(orgMspId);
    const { role } = req.user;
    return this.casesService.getCase(id, org as 'Org1MSP' | 'Org2MSP', role);
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