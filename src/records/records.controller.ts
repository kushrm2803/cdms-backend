import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseInterceptors,
  UploadedFile,
  Logger,
  Res,
  StreamableFile,
  ForbiddenException,
  Query,
  Put,
  UseGuards,
  BadRequestException,
  NotFoundException,
  Request
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { normalizeOrgMspId } from '../utils/normalizers';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Express } from 'express';
import { RecordsService } from './records.service';
import { CreateRecordDto } from './dto/create-record.dto';
import { UpdateRecordDto } from './dto/update-record.dto';
import { SearchRecordsDto } from './dto/search-records.dto';
import { UpdateMetadataDto } from './dto/update-metadata.dto';
import type { Response } from 'express';

@Controller('records')
@UseGuards(JwtAuthGuard)
export class RecordsController {
  private readonly logger = new Logger(RecordsController.name);

  constructor(private readonly recordsService: RecordsService) {}

  /**
   * POST /records?org=Org1MSP
   * Creates a new record with policy-based access control
   */
  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async create(
    @UploadedFile() file: Express.Multer.File,
    @Body() createRecordDto: CreateRecordDto,
  @Query('org') orgMspId: string,
  @Request() req: any,
  ) {
  const org = normalizeOrgMspId(orgMspId);
    if (!org) {
      throw new BadRequestException('Organization MSP ID (?org=...) is required.');
    }

    if (!file) {
      throw new BadRequestException('File is required.');
    }

    try {
      const { role: userRole, organization: userOrg } = req.user;
      return await this.recordsService.create(
        file,
        createRecordDto,
        org as 'Org1MSP' | 'Org2MSP',
        userRole,
        userOrg
      );
    } catch (error) {
      if (error.message.includes('Access denied')) {
        throw new ForbiddenException(error.message);
      }
      throw new BadRequestException(`Failed to create record: ${error.message}`);
    }
  }

  /**
   * GET /records?org=Org1MSP
   * Lists all accessible records based on policy
   */
  @Get()
  async findAll(
  @Query('org') orgMspId: string,
  @Request() req: any,
  ) {
  const org = normalizeOrgMspId(orgMspId);
    if (!org) {
      throw new BadRequestException('Organization MSP ID (?org=...) is required.');
    }

    try {
      const { role: userRole, organization: userOrg } = req.user;
      const records = await this.recordsService.findAll(
        org as 'Org1MSP' | 'Org2MSP',
        userRole,
        userOrg
      );
      return records;
    } catch (error) {
      throw new BadRequestException(`Failed to retrieve records: ${error.message}`);
    }
  }

  /**
   * GET /records/:id?org=Org1MSP
   * Downloads a record if the user has access based on policy
   */
  @Get(':id')
  async findOne(
    @Param('id') id: string,
  @Query('org') orgMspId: string,
  @Res({ passthrough: true }) res: Response,
  @Request() req: any,
  ) {
  const org = normalizeOrgMspId(orgMspId);
    if (!org) {
      throw new BadRequestException('Organization MSP ID (?org=...) is required.');
    }

    try {
      const { role: userRole, organization: userOrg } = req.user;
      const { decryptedFile, record } = await this.recordsService.findOne(
        id,
        org as 'Org1MSP' | 'Org2MSP',
        userRole,
        userOrg
      );

      // Set file download headers
      res.set({
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="decrypted_${record.id}"`,
      });

      return new StreamableFile(decryptedFile);
    } catch (error) {
      if (error.message.includes('Access denied') || error.message.includes('Policy')) {
        throw new ForbiddenException(error.message);
      }
      if (error.message.includes('not found')) {
        throw new NotFoundException(error.message);
      }
      throw new BadRequestException(`Failed to retrieve record: ${error.message}`);
    }
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateRecordDto: UpdateRecordDto) {
    return this.recordsService.update(+id, updateRecordDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.recordsService.remove(+id);
  }

  @Get('case/:caseId')
  async getRecordsByCase(
    @Param('caseId') caseId: string,
    @Query('org') orgMspId: string,
    @Request() req: any,
  ) {
  const org = normalizeOrgMspId(orgMspId);
    if (!org) {
      throw new ForbiddenException('Organization MSP ID is required in query parameter (?org=Org1MSP)');
    }

    try {
      const { role: userRole, organization: userOrg } = req.user;
      return await this.recordsService.getRecordsByCase(
        caseId,
        org as 'Org1MSP' | 'Org2MSP',
        userRole,
        userOrg,
      );
    } catch (error) {
      if (error.message.includes('access denied')) {
        throw new ForbiddenException(error.message);
      }
      throw error;
    }
  }

  @Get('search')
  async searchRecords(@Query() searchParams: SearchRecordsDto) {
    return this.recordsService.searchRecords(searchParams);
  }

  @Put(':id/metadata')
  async updateRecordMetadata(
    @Param('id') id: string,
    @Body() metadata: UpdateMetadataDto,
    @Query('org') orgMspId: string,
  ) {
    const org = normalizeOrgMspId(orgMspId);
    return this.recordsService.updateMetadata(id, metadata, org as 'Org1MSP' | 'Org2MSP');
  }
}