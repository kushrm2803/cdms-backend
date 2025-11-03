import { Injectable, Logger } from '@nestjs/common';
import { CreateRecordDto } from './dto/create-record.dto';
import { UpdateRecordDto } from './dto/update-record.dto';
import type { Express } from 'express';
import { MinioService } from './minio.service';
import { VaultService } from './vault.service';
import { FabricService } from './fabric.service';
import * as path from 'path';
import { createHash } from 'crypto';

@Injectable()
export class RecordsService {
  private readonly logger = new Logger(RecordsService.name);

  constructor(
    private readonly minioService: MinioService,
    private readonly vaultService: VaultService,
    private readonly fabricService: FabricService,
  ) {}

  async create(file: Express.Multer.File, createRecordDto: CreateRecordDto) {
    this.logger.log('--- In Records Service (Full E2E Flow) ---');
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
      const uploadResult = await this.minioService.upload(
        encryptedFile as Express.Multer.File,
        fileExtension + '.enc',
      );
      this.logger.log('Encrypted file uploaded to MinIO.', uploadResult);

      this.logger.log('Calculating SHA-256 hash of original file...');
      const fileHash = createHash('sha256').update(file.buffer).digest('hex');
      this.logger.log(`File hash: ${fileHash}`);

      this.logger.log('Testing Fabric connection...');
      const fabricTestResult = await this.fabricService.testConnection();
      this.logger.log('Fabric connection test successful.');

      // 7. TODO (Future): Replace testConnection() with a real chaincode call
      //    const fabricResponse = await this.fabricService.createRecord({
      //      ...createRecordDto,
      //      fileHash: fileHash,
      //      minioPath: uploadResult.Key,
      //    });

      return {
        message: 'File encrypted, uploaded, and Fabric connection tested!',
        fileHash: fileHash,
        minioResponse: uploadResult,
        fabricTestResponse: JSON.parse(fabricTestResult),
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