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

  /**
   * Validates if a user has permission to create a record
   */
  private canCreateRecord(userRole: string, userOrg: string, ownerOrg: string): boolean {
    // Admin can create records for any org
    if (userRole === 'admin') {
      return true;
    }

    // Investigator can only create records for their own org
    if (userRole === 'investigator' && userOrg === ownerOrg) {
      return true;
    }

    // Other roles cannot create records
    return false;
  }

  /**
   * Validates that a policy exists and is accessible
   */
  private async validatePolicy(policyId: string, orgMspId: 'Org1MSP' | 'Org2MSP'): Promise<boolean> {
    try {
      const policyJson = await this.fabricService.queryPolicy(policyId, orgMspId);
      const policy = JSON.parse(policyJson);
      return !!policy && !!policy.policyId;
    } catch (error) {
      this.logger.error(`Failed to validate policy ${policyId}:`, error);
      return false;
    }
  }

  /**
   * Validates if a user has access to a case
   */
  private async validateCaseAccess(
    caseId: string,
    orgMspId: 'Org1MSP' | 'Org2MSP',
    userRole: string,
    userOrg: string
  ): Promise<void> {
    try {
      // Query case details from chaincode
      const caseResult = await this.fabricService.queryCase(caseId, orgMspId);
      const caseData = JSON.parse(caseResult);

      // Admin has access to all cases
      if (userRole === 'admin') {
        return;
      }

      // Check org-based access
      if (userOrg !== caseData.ownerOrg) {
        throw new Error('Access denied: Case belongs to a different organization');
      }

      // Additional role-based checks can be added here
      switch (userRole) {
        case 'investigator':
          // Investigators can access cases they're assigned to
          if (!caseData.investigators?.includes(userOrg)) {
            throw new Error('Access denied: Not assigned to this case');
          }
          break;
        // Add more role checks as needed
        default:
          throw new Error(`Access denied: Role ${userRole} cannot access cases`);
      }
    } catch (error) {
      throw new Error(`Case access validation failed: ${error.message}`);
    }
  }

  /**
   * Validates if a user has access to view a record based on its policy
   */
  private async validateRecordAccess(
    record: any,
    userRole: string,
    userOrg: string
  ): Promise<void> {
    // If no policy is attached, only allow admin access
    if (!record.policyId) {
      if (userRole !== 'admin') {
        throw new Error('Access denied: Record has no access policy');
      }
      return;
    }

    try {
      const policyJson = await this.fabricService.queryPolicy(record.policyId, record.ownerOrg);
      const policy = JSON.parse(policyJson);

      let hasAccess = false;
      for (const rule of policy.rules) {
        // Check allow rules
        if (rule.allow) {
          if (rule.allow.org === userOrg || rule.allow.role?.includes(userRole)) {
            hasAccess = true;
          }
        }

        // Check deny rules (these override allow rules)
        if (rule.deny) {
          if (rule.deny.org === userOrg || rule.deny.role?.includes(userRole)) {
            hasAccess = false;
            break;
          }
        }
      }

      if (!hasAccess) {
        throw new Error('Access denied by policy rules');
      }
    } catch (error) {
      throw new Error(`Policy validation failed: ${error.message}`);
    }
  }

  async create(
    file: Express.Multer.File,
    createRecordDto: CreateRecordDto,
    orgMspId: 'Org1MSP' | 'Org2MSP',
    userRole: string,
    userOrg: string
  ) {
    this.logger.log('--- In Records Service (Real CreateRecord Flow) ---');

    // First, validate the user's role and organization
    if (!this.canCreateRecord(userRole, userOrg, createRecordDto.ownerOrg)) {
      throw new Error('Access denied: Insufficient permissions to create records');
    }

    try {
      // 1. Validate policy first
      if (createRecordDto.policyId) {
        const policyExists = await this.validatePolicy(createRecordDto.policyId, orgMspId);
        if (!policyExists) {
          throw new Error(`Policy ${createRecordDto.policyId} does not exist`);
        }
      }

      // 2. Encrypt file
      this.logger.log('Encrypting file with Vault...');
      const ciphertext = await this.vaultService.encrypt(file.buffer);
      const encryptedFileBuffer = Buffer.from(ciphertext);

      // 3. Get file details and upload to MinIO
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
      this.logger.log('Encrypted file uploaded to MinIO.', uploadResult.Key);

      // 4. Calculate hash of original file
      const fileHash = createHash('sha256').update(file.buffer).digest('hex');
      this.logger.log(`File hash: ${fileHash}`);

      // 5. Generate IDs and metadata
      const newRecordId = uuid();
      const createdAt = new Date().toISOString();
      const policyId = createRecordDto.policyId || `policy-${uuid()}`;

      // 6. Create and validate the payload
      const fabricPayload: RecordPayload = {
        id: newRecordId,
        caseId: createRecordDto.caseId,
        recordType: createRecordDto.recordType,
        fileHash: fileHash,
        offChainUri: uploadResult.Key,
        ownerOrg: createRecordDto.ownerOrg,
        createdAt: createdAt,
        policyId: policyId,
      };

      // Validate case access if caseId is provided
      if (createRecordDto.caseId) {
        await this.validateCaseAccess(createRecordDto.caseId, orgMspId, userRole, userOrg);
      }

      // 7. Submit to Fabric
      this.logger.log(`Submitting record to Fabric as ${orgMspId}...`);
      await this.fabricService.createRecord(fabricPayload, orgMspId);
      this.logger.log('Fabric transaction successful.');

      // 8. Verify the record was created
      this.logger.log(`Querying Fabric to verify...`);
      const queryResult = await this.fabricService.queryRecord(
        newRecordId,
        orgMspId,
        userRole
      );
      this.logger.log('Record verified successfully.');

      return {
        message: 'Record created, encrypted, stored, and logged on blockchain!',
        recordId: newRecordId,
        minioPath: uploadResult.Key,
        recordData: JSON.parse(queryResult),
      };
    } catch (error) {
      this.logger.error('Failed to create record:', error);
      // Clean up MinIO file if it was uploaded
      if (error.minioKey) {
        await this.minioService.delete(error.minioKey).catch(err => {
          this.logger.error('Failed to clean up MinIO file:', err);
        });
      }
      throw new Error(`Failed to create record: ${error.message}`);
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
  async findAll(
    orgMspId: 'Org1MSP' | 'Org2MSP',
    userRole: string,
    userOrg: string
  ) {
    this.logger.log(`Getting all accessible records for ${userRole} in ${userOrg}`);
    
    try {
      // First get all records through chaincode query
      const recordsJson = await this.fabricService.queryRecords({
        orgMspId,
        userRole,
        organization: userOrg
      });
      const records = JSON.parse(recordsJson);

      // Filter records based on policy access for each record
      const accessibleRecords: any[] = [];
      for (const record of records) {
        try {
          await this.validateRecordAccess(record, userRole, userOrg);
          accessibleRecords.push(record);
        } catch (error) {
          // Skip records that the user doesn't have access to
          this.logger.debug(`Skipping record ${record.id}: ${error.message}`);
        }
      }

      return accessibleRecords;
    } catch (error) {
      this.logger.error('Failed to retrieve records:', error);
      throw new Error(`Failed to retrieve records: ${error.message}`);
    }
  }
  async findOne(id: string, orgMspId: 'Org1MSP' | 'Org2MSP', userRole: string, userOrg: string) {
    if (!orgMspId) {
      throw new Error('Organization MSP ID is required to access records');
    }

    this.logger.log(
      `--- In Records Service (Secure FindOne Flow for ${orgMspId}, role: ${userRole}, org: ${userOrg}) ---`,
    );

    try {
      // 1. Query the blockchain (This will fail if policy denies access)
      this.logger.log(`Querying Fabric for record ${id} as ${orgMspId} with role ${userRole}...`);
      // We use the orgMspId and userRole that was passed in
      const recordJSON = await this.fabricService.queryRecord(id, orgMspId, userRole);
      const record = JSON.parse(recordJSON);
      this.logger.log('Access granted by Fabric.');

      // Validate policy-based access
      await this.validateRecordAccess(record, userRole, userOrg);

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
    if (!orgMspId) {
      throw new Error('Organization MSP ID is required to access records');
    }

    this.logger.log(`Getting records for case ${caseId} as ${orgMspId}`);
    try {
      const records = await this.fabricService.queryRecordsByCase(caseId, orgMspId);
      return JSON.parse(records);
    } catch (error) {
      if (error.message.includes('access denied')) {
        throw new Error(`Access denied: Organization ${orgMspId} is not allowed to access these records`);
      }
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
