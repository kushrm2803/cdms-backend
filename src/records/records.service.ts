import { Injectable, Logger } from '@nestjs/common';
import { CreateRecordDto } from './dto/create-record.dto';
import { UpdateRecordDto } from './dto/update-record.dto';
import type { Express } from 'express';
import { MinioService } from './minio.service';
import { VaultService } from './vault.service';
import * as path from 'path';

@Injectable()
export class RecordsService {
  private readonly logger = new Logger(RecordsService.name);

  constructor(
    private readonly minioService: MinioService,
    private readonly vaultService: VaultService,
  ) {}

  async create(file: Express.Multer.File, createRecordDto: CreateRecordDto) {
    this.logger.log('--- In Records Service (Full Flow) ---');
    this.logger.log('Received file:', file.originalname);

    try {
      this.logger.log('Encrypting file with Vault...');
      const ciphertext = await this.vaultService.encrypt(file.buffer);
      this.logger.log('File encrypted successfully by Vault.');

      const encryptedFileBuffer = Buffer.from(ciphertext);

      const fileExtension = path.extname(file.originalname);

      const encryptedFile = {
        buffer: encryptedFileBuffer,
        mimetype: 'application/octet-stream',
        originalname: `${file.originalname}.enc`,
      };

      this.logger.log('Uploading encrypted file to MinIO...');
      const uploadResult = await this.minioService.upload(
        encryptedFile as Express.Multer.File,
        fileExtension + '.enc',
      );
      this.logger.log('Encrypted file uploaded to MinIO.', uploadResult);

      // TODO: Get the hash of the *original* file (file.buffer)

      // TODO: Call Fabric chaincode to store the metadata

      return {
        message: 'File encrypted and uploaded successfully!',
        minioResponse: uploadResult,
        // fabricResponse: fabricResponse,
      };

    } catch (error) {
      this.logger.error('Failed the create flow', error);
      throw new Error('Failed to create record.');
    }
  }


  findAll() {
    return `This action returns all records`;
  }

  findOne(id: number) {
    return `This action returns a #${id} record`;
  }

  update(id: number, updateRecordDto: UpdateRecordDto) {
    return `This action updates a #${id} record`;
  }

  remove(id: number) {
    return `This action removes a #${id} record`;
  }
}