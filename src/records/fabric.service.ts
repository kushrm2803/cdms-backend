import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Gateway,
  GatewayOptions,
  Wallets,
  X509Identity,
} from 'fabric-network';
import * as path from 'path';
import * as fs from 'fs';

// Define our org types
type OrgMspId = 'Org1MSP' | 'Org2MSP';

// This is the data structure we defined in our chaincode
export interface RecordPayload {
  id: string;
  caseId: string;
  recordType: string;
  fileHash: string;
  offChainUri: string;
  createdAt: string;
  policyId: string;
}

@Injectable()
export class FabricService {
  private readonly logger = new Logger(FabricService.name);
  private readonly chaincodeName = 'cdms'; // Use our new chaincode name
  private readonly channelName = 'mychannel';
  private readonly walletPath: string;

  constructor(private readonly configService: ConfigService) {
    // Define the wallet path once
    this.walletPath = path.resolve(__dirname, '..', '..', 'fabric-config', 'wallet');
  }

  /**
   * Connects to the Fabric gateway using a specific org's identity
   */
  /**
   * Connects to the Fabric gateway using a specific org's identity
   */
  private async connect(
    identityName: string,
    mspId: OrgMspId,
    mspDir: string,
  ): Promise<Gateway> {
    
    // 1. Setup the wallet
    const wallet = await Wallets.newFileSystemWallet(this.walletPath);
    this.logger.log(`Wallet path: ${this.walletPath}`);

    // 2. Setup the connection profile (the "map")
    const ccpPath = path.resolve(
      __dirname,
      '..',
      '..',
      'fabric-config',
      'connection-org1.json', // We always use our "Super Map"
    );
    const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));

    // 3. Check if identity exists. If not, create it from our new msps folder
    const identityExists = await wallet.get(identityName);
    if (!identityExists) {
      this.logger.warn(`Identity ${identityName} not found. Attempting to import...`);
      try {
        
        // --- THIS IS THE FIX ---
        // The mspFolderPath is now inside the walletPath
        const mspFolderPath = path.resolve(
          this.walletPath, // <-- Use the walletPath variable
          'msps',
          mspDir,
        );
        // --- END OF FIX ---

        const certPath = path.resolve(
          mspFolderPath,
          'signcerts',
          fs.readdirSync(path.resolve(mspFolderPath, 'signcerts'))[0], // Get the first cert file
        );
        const certificate = fs.readFileSync(certPath, 'utf8');

        const keyDir = path.resolve(mspFolderPath, 'keystore');
        const keyFile = fs.readdirSync(keyDir).find((file) => file.endsWith('_sk'));
        if (!keyFile) {
          throw new Error(`Private key not found in ${keyDir}`);
        }
        const keyPath = path.resolve(keyDir, keyFile);
        const privateKey = fs.readFileSync(keyPath, 'utf8');

        const newIdentity: X509Identity = {
          credentials: { certificate, privateKey },
          mspId: mspId,
          type: 'X.509',
        };

        await wallet.put(identityName, newIdentity);
        this.logger.log(`Successfully imported identity ${identityName} into wallet.`);
      } catch (importError) {
        this.logger.error('Failed to import identity', importError);
        throw new Error('Failed to setup Fabric identity.');
      }
    }

    // 4. Define the gateway connection options
    const gatewayOptions: GatewayOptions = {
      wallet,
      identity: identityName,
      discovery: {
        enabled: false, // We use our "Super Map"
        asLocalhost: false,
      },
    };

    // 5. Connect to the gateway
    const gateway = new Gateway();
    this.logger.log(`Connecting to Fabric gateway as ${identityName}...`);
    await gateway.connect(ccp, gatewayOptions);
    this.logger.log('Successfully connected to gateway.');

    return gateway;
  }

  // Helper to get connection details based on OrgMspId
  private getConnectionDetails(orgMspId: OrgMspId) {
    if (orgMspId === 'Org1MSP') {
      return {
        identityName: 'Admin@org1.example.com',
        mspDir: 'org1',
      };
    } else if (orgMspId === 'Org2MSP') {
      return {
        identityName: 'Admin@org2.example.com',
        mspDir: 'org2',
      };
    }
    throw new Error(`Invalid organization MSP: ${orgMspId}`);
  }

  /**
   * Submits the CreateRecord transaction as a specific org
   */
  async createRecord(payload: RecordPayload, orgMspId: OrgMspId): Promise<void> {
    this.logger.log(`Submitting 'CreateRecord' as ${orgMspId} for ID: ${payload.id}`);
    let gateway: Gateway | undefined = undefined;
    const { identityName, mspDir } = this.getConnectionDetails(orgMspId);

    try {
      gateway = await this.connect(identityName, orgMspId, mspDir);
      const network = await gateway.getNetwork(this.channelName);
      const contract = network.getContract(this.chaincodeName);

      await contract.submitTransaction(
        'CreateRecord',
        payload.id,
        payload.caseId,
        payload.recordType,
        payload.fileHash,
        payload.offChainUri,
        payload.createdAt,
        payload.policyId,
      );

      this.logger.log(`Transaction 'CreateRecord' committed successfully by ${orgMspId}.`);
    } catch (error) {
      this.logger.error(`Failed to submit 'CreateRecord' as ${orgMspId}`, error);
      throw error;
    } finally {
      if (gateway) {
        gateway.disconnect();
        this.logger.log('Disconnected from Fabric gateway.');
      }
    }
  }

  /**
   * Queries a record as a specific org
   */
  async queryRecord(id: string, orgMspId: OrgMspId): Promise<string> {
    this.logger.log(`Evaluating 'QueryRecord' as ${orgMspId} for ID: ${id}`);
    let gateway: Gateway | undefined = undefined;
    const { identityName, mspDir } = this.getConnectionDetails(orgMspId);

    try {
      gateway = await this.connect(identityName, orgMspId, mspDir);
      const network = await gateway.getNetwork(this.channelName);
      const contract = network.getContract(this.chaincodeName);

      const result = await contract.evaluateTransaction('QueryRecord', id);

      this.logger.log(`Transaction 'QueryRecord' evaluated successfully by ${orgMspId}.`);
      return result.toString();
    } catch (error) {
      this.logger.error(`Failed to evaluate 'QueryRecord' as ${orgMspId}`, error);
      throw error;
    } finally {
      if (gateway) {
        gateway.disconnect();
        this.logger.log('Disconnected from Fabric gateway.');
      }
    }
  }
}