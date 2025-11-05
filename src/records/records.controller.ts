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
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Express } from 'express';
import { RecordsService } from './records.service';
import { CreateRecordDto } from './dto/create-record.dto';
import { UpdateRecordDto } from './dto/update-record.dto';

@Controller('records')
export class RecordsController {
  constructor(private readonly recordsService: RecordsService) {}
  private readonly logger = new Logger(RecordsController.name);

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

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.recordsService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateRecordDto: UpdateRecordDto) {
    return this.recordsService.update(+id, updateRecordDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.recordsService.remove(+id);
  }
}