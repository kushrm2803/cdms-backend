import { Injectable, Logger } from '@nestjs/common';
import { CreateRecordDto } from './dto/create-record.dto';
import { UpdateRecordDto } from './dto/update-record.dto';
import { SearchRecordsDto } from './dto/search-records.dto';
import { UpdateMetadataDto } from './dto/update-metadata.dto';
import type { Express } from 'express';
import { MinioService } from './minio.service';
import { VaultService } from './vault.service';
import { FabricService, RecordPayload } from './fabric.service';
import * as path from 'path';
import { createHash } from 'crypto';
import { v4 as uuid } from 'uuid';

@Injectable()
export class RecordsService {
  private readonly logger = new Logger(RecordsService.name);

  constructor(
    private readonly minioService: MinioService,
    private readonly vaultService: VaultService,
    private readonly fabricService: FabricService,
  ) {}

  async create(file: Express.Multer.File, createRecordDto: CreateRecordDto) {
    this.logger.log('--- In Records Service (Real CreateRecord Flow) ---');

    // We'll hard-code the creating org as Org1 for now
    const orgMspId = 'Org1MSP';

    try {
      // 1. Encrypt
      this.logger.log('Encrypting file with Vault...');
      const ciphertext = await this.vaultService.encrypt(file.buffer);
      const encryptedFileBuffer = Buffer.from(ciphertext);

      // 2. Get file details
      const fileExtension = path.extname(file.originalname);

      // 3. Upload to MinIO
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

      // 4. Get hash of *original* file
      const fileHash = createHash('sha256').update(file.buffer).digest('hex');
      this.logger.log(`File hash: ${fileHash}`);

      // 5. Generate IDs
      const newRecordId = uuid();
      const createdAt = new Date().toISOString();

      // --- THIS IS THE FIX ---
      // Use the policyId from Postman if it exists,
      // otherwise, create a new random one.
      const newPolicyId = createRecordDto.policyId || `policy-${uuid()}`;
      this.logger.log(`Using Policy ID: ${newPolicyId}`);
      // --- END OF FIX ---

      // 6. Create payload
      const fabricPayload: RecordPayload = {
        id: newRecordId,
        caseId: createRecordDto.caseId,
        recordType: createRecordDto.recordType,
        fileHash: fileHash,
        offChainUri: uploadResult.Key,
        ownerOrg: createRecordDto.ownerOrg,
        createdAt: createdAt,
        policyId: newPolicyId, // <-- Use the final policyId
      };

      // 7. Submit to Fabric
      this.logger.log(`Submitting record to Fabric as ${orgMspId}...`);
      await this.fabricService.createRecord(fabricPayload, orgMspId);
      this.logger.log('Fabric transaction successful.');

      // 8. Query to verify
      this.logger.log(`Querying Fabric as ${orgMspId} to verify...`);
      const queryResult = await this.fabricService.queryRecord(
        newRecordId,
        orgMspId,
      );
      this.logger.log('Fabric query successful.');

      return {
        message: 'Record created, encrypted, stored, and logged on blockchain!',
        recordId: newRecordId,
        minioPath: uploadResult.Key,
        recordData: JSON.parse(queryResult),
      };
    } catch (error) {
      this.logger.error('Failed the create flow', error);
      throw new Error('Failed to create record.');
    }
  }

  /**
   * --- FIX: UPDATED createPolicy to call the v4 service ---
   */
  async createPolicy(policyData: any) {
    this.logger.log('--- In Records Service (CreatePolicy Flow) ---');
    const orgMspId = 'Org1MSP'; // Admin action

    try {
      const categoriesJSON = JSON.stringify(policyData.categories);
      const rulesJSON = JSON.stringify(policyData.rules);
      const policyId = policyData.policyId;

      this.logger.log(`Submitting policy ${policyId} to Fabric...`);
      await this.fabricService.createPolicy(
        policyId,
        categoriesJSON,
        rulesJSON,
        orgMspId,
      );
      this.logger.log('Fabric transaction successful.');

      return {
        message: 'Policy created successfully on the blockchain!',
        policyId: policyId,
      };
    } catch (error) {
      this.logger.error('Failed the create policy flow', error);
      throw new Error('Failed to create policy.');
    }
  }

  // --- Keep the other generated methods as-is ---
  findAll() {
    return `This action returns all records`;
  }
  async findOne(id: string, orgMspId: 'Org1MSP' | 'Org2MSP') {
    // <-- IT'S NOW AN ARGUMENT
    this.logger.log(
      `--- In Records Service (Secure FindOne Flow for ${orgMspId}) ---`,
    );

    try {
      // 1. Query the blockchain (This will fail if policy denies access)
      this.logger.log(`Querying Fabric for record ${id} as ${orgMspId}...`);
      // We use the orgMspId variable that was passed in
      const recordJSON = await this.fabricService.queryRecord(id, orgMspId);
      const record = JSON.parse(recordJSON);
      this.logger.log('Access granted by Fabric.');

      // 2. Download the encrypted file from MinIO
      this.logger.log(`Downloading file ${record.offChainUri} from MinIO...`);
      const encryptedFileBuffer = await this.minioService.download(
        record.offChainUri,
      );
      this.logger.log('File downloaded.');

      // 3. Decrypt the file using Vault
      this.logger.log('Decrypting file with Vault...');
      const encryptedFileString = encryptedFileBuffer.toString();
      const decryptedFile =
        await this.vaultService.decrypt(encryptedFileString);
      this.logger.log('File decrypted.');

      // 4. Return the decrypted file and the record metadata
      return { decryptedFile: decryptedFile, record: record };
    } catch (error) {
      this.logger.error(`Failed the findOne flow for record ${id}`, error);
      // Re-throw the error so the controller can handle it
      throw error;
    }
  }
  update(id: number, updateRecordDto: UpdateRecordDto) {
    return `This action updates a #${id} record`;
  }
  remove(id: number) {
    return `This action removes a #${id} record`;
  }

  async getRecordsByCase(caseId: string, orgMspId: 'Org1MSP' | 'Org2MSP') {
    this.logger.log(`Getting records for case ${caseId} as ${orgMspId}`);
    try {
      // Need to add QueryRecordsByCase to fabric.service.ts
      const records = await this.fabricService.queryRecordsByCase(caseId, orgMspId);
      return JSON.parse(records);
    } catch (error) {
      this.logger.error(`Failed to get records for case ${caseId}`, error);
      throw error;
    }
  }

  async searchRecords(searchParams: SearchRecordsDto) {
    this.logger.log('Searching records with params:', searchParams);
    try {
      // Need to add QueryRecords to fabric.service.ts
      const records = await this.fabricService.queryRecords(searchParams);
      return JSON.parse(records);
    } catch (error) {
      this.logger.error('Failed to search records', error);
      throw error;
    }
  }

  async updateMetadata(
    id: string, 
    metadata: UpdateMetadataDto, 
    orgMspId: 'Org1MSP' | 'Org2MSP'
  ) {
    this.logger.log(`Updating metadata for record ${id} as ${orgMspId}`);
    try {
      // Need to add UpdateRecordMetadata to fabric.service.ts
      await this.fabricService.updateRecordMetadata(id, metadata, orgMspId);
      return { message: 'Record metadata updated successfully' };
    } catch (error) {
      this.logger.error(`Failed to update metadata for record ${id}`, error);
      throw error;
    }
  }
}
