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
  Res, // <-- Import this
  StreamableFile, // <-- Import this
  ForbiddenException, // <-- Import this
  Query
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Express } from 'express';
import { RecordsService } from './records.service';
import { CreateRecordDto } from './dto/create-record.dto';
import { UpdateRecordDto } from './dto/update-record.dto';
import type { Response } from 'express'; // <-- Import the express Response type

@Controller('records')
export class RecordsController {
  private readonly logger = new Logger(RecordsController.name);

  constructor(private readonly recordsService: RecordsService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  create(
    @UploadedFile() file: Express.Multer.File,
    @Body() createRecordDto: CreateRecordDto,
  ) {
    return this.recordsService.create(file, createRecordDto);
  }

  @Post('policies')
  createPolicy(@Body() policyData: any) {
    this.logger.log('Received request to create policy:', policyData);
    return this.recordsService.createPolicy(policyData);
  }

  @Get()
  findAll() {
    return this.recordsService.findAll();
  }

  // --- THIS IS THE NEW DOWNLOAD ENDPOINT ---
  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Query('org') orgMspId: 'Org1MSP' | 'Org2MSP', // <-- ADDED THIS
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      // We now pass the orgMspId from the URL to the service
      const { decryptedFile, record } = await this.recordsService.findOne(
        id,
        orgMspId, // <-- PASS IT HERE
      );

      // We need to tell the browser what kind of file this is
      // For now, we'll just set a generic "download" type
      res.set({
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="decrypted_${record.id}"`,
      });

      // Return the file stream
      return new StreamableFile(decryptedFile);
    } catch (error) {
      if (error.message.includes('access denied')) {
        throw new ForbiddenException(error.message);
      }
      throw error;
    }
  }
  // --- END OF NEW ENDPOINT ---

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateRecordDto: UpdateRecordDto) {
    return this.recordsService.update(+id, updateRecordDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.recordsService.remove(+id);
  }
}