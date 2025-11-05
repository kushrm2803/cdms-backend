import { Injectable, Logger } from '@nestjs/common';
import { CreateRecordDto } from './dto/create-record.dto';
import { UpdateRecordDto } from './dto/update-record.dto';
import type { Express } from 'express';
import { MinioService } from './minio.service';
import { VaultService } from './vault.service';
import { FabricService, RecordPayload } from './fabric.service'; // <-- Import new payload
import * as path from 'path';
import { createHash } from 'crypto';
import { v4 as uuid } from 'uuid'; // <-- Import UUID

@Injectable()
export class RecordsService {
  private readonly logger = new Logger(RecordsService.name);

  constructor(
    private readonly minioService: MinioService,
    private readonly vaultService: VaultService,
    private readonly fabricService: FabricService,
  ) {}

  /**
   * FINAL, REAL create method
   */
  async create(file: Express.Multer.File, createRecordDto: CreateRecordDto) {
    this.logger.log('--- In Records Service (Real CreateRecord Flow) ---');
    
    // We'll hard-code the creating org as Org1 for now
    const orgMspId: 'Org1MSP' | 'Org2MSP' = 'Org1MSP';

    try {
      // 1. Encrypt the file buffer using Vault
      this.logger.log('Encrypting file with Vault...');
      const ciphertext = await this.vaultService.encrypt(file.buffer);

      // 2. Convert ciphertext to a buffer for upload
      const encryptedFileBuffer = Buffer.from(ciphertext);

      // 3. Get the *original* file extension
      const fileExtension = path.extname(file.originalname);

      // 4. Upload the *encrypted buffer* to MinIO
      const encryptedFile = {
        buffer: encryptedFileBuffer,
        mimetype: 'application/octet-stream',
        originalname: `${file.originalname}.enc`,
      };
      const uploadResult = await this.minioService.upload(
        encryptedFile as Express.Multer.File,
        fileExtension + '.enc',
      );
      this.logger.log('Encrypted file uploaded to MinIO.', uploadResult.Key);

      // 5. Get the hash of the *ORIGINAL* file for the blockchain proof
      const fileHash = createHash('sha256').update(file.buffer).digest('hex');
      this.logger.log(`File hash: ${fileHash}`);

      // 6. Generate IDs for the new record
      const newRecordId = uuid();
      const newPolicyId = `policy-${uuid()}`; // Simple policy ID for now
      const createdAt = new Date().toISOString();

      // 7. Create the payload for the blockchain
      const fabricPayload: RecordPayload = {
        id: newRecordId,
        caseId: createRecordDto.caseId,
        recordType: createRecordDto.recordType,
        fileHash: fileHash,
        offChainUri: uploadResult.Key, // The unique key/filename from MinIO
        createdAt: createdAt,
        policyId: newPolicyId,
      };

      // 8. Submit the transaction to the Fabric chaincode as our chosen org
      this.logger.log(`Submitting record to Fabric as ${orgMspId}...`);
      await this.fabricService.createRecord(fabricPayload, orgMspId);
      this.logger.log('Fabric transaction successful.');

      // 9. As a test, immediately query the record we just created
      this.logger.log(`Querying Fabric as ${orgMspId} to verify...`);
      const queryResult = await this.fabricService.queryRecord(newRecordId, orgMspId);
      this.logger.log('Fabric query successful.');

      return {
        message: 'Record created, encrypted, stored, and logged on blockchain!',
        recordId: newRecordId,
        minioPath: uploadResult.Key,
        recordData: JSON.parse(queryResult), // The new record from the blockchain
      };
    } catch (error) {
      this.logger.error('Failed the create flow', error);
      throw new Error('Failed to create record.');
    }
  }

  // --- Keep the other generated methods as-is ---
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