import { Injectable, Logger } from '@nestjs/common';
import * as grpc from '@grpc/grpc-js';
import {
  connect,
  hash,
  signers,
  Gateway,
  Contract,
} from '@hyperledger/fabric-gateway';
import * as crypto from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as path from 'path';

// --- FIX: ADDED THIS TYPE DEFINITION ---
type OrgMspId = 'Org1MSP' | 'Org2MSP';

// This is the data structure from our 'cdms' chaincode
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
  private readonly channelName = 'mychannel';
  private readonly chaincodeName = 'cdms';
  private readonly mspIdOrg1 = 'Org1MSP';
  private readonly mspIdOrg2 = 'Org2MSP';
  
  // Paths to our crypto files
  private readonly tlsCertPath = path.resolve(__dirname, '..', '..', 'fabric-config', 'tls-root-cert.pem');
  
  // Org1 details
  private readonly peerEndpointOrg1 = 'localhost:7051';
  private readonly peerHostAliasOrg1 = 'peer0.org1.example.com';
  private readonly certPathOrg1 = path.resolve(__dirname, '..', '..', 'fabric-config', 'Admin@org1.example.com-cert.pem');
  private readonly keyPathOrg1 = path.resolve(__dirname, '..', '..', 'fabric-config', 'key.pem'); // Assuming this is Org1's key

  // TODO: Add Org2 details
  // private readonly peerEndpointOrg2 = 'localhost:9051';
  // private readonly peerHostAliasOrg2 = 'peer0.org2.example.com';
  // private readonly certPathOrg2 = path.resolve(__dirname, '..', '..', 'fabric-config', 'Admin@org2.example.com-cert.pem');
  // private readonly keyPathOrg2 = path.resolve(__dirname, '..', '..', 'fabric-config', 'key-org2.pem');


  /**
   * Creates a new gRPC connection to a peer
   */
  private async newGrpcConnection(
    peerEndpoint: string,
    peerHostAlias: string,
  ): Promise<grpc.Client> {
    const tlsRootCert = await fs.readFile(this.tlsCertPath);
    return new grpc.Client(
      peerEndpoint,
      grpc.credentials.createSsl(tlsRootCert),
      {
        'grpc.ssl_target_name_override': peerHostAlias,
      },
    );
  }

  /**
   * Connects to the Fabric gateway using a specific org's identity
   */
  private async connect(
    orgMspId: OrgMspId,
  ): Promise<{ gateway: Gateway; client: grpc.Client }> {
    
    // --- FIX: ADDED DYNAMIC CONNECTION LOGIC ---
    let mspId: string;
    let certPath: string;
    let keyPath: string;
    let client: grpc.Client;

    if (orgMspId === 'Org1MSP') {
      mspId = this.mspIdOrg1;
      certPath = this.certPathOrg1;
      keyPath = this.keyPathOrg1;
      client = await this.newGrpcConnection(this.peerEndpointOrg1, this.peerHostAliasOrg1);
    } 
    // else if (orgMspId === 'Org2MSP') {
    //   mspId = this.mspIdOrg2;
    //   certPath = this.certPathOrg2;
    //   keyPath = this.keyPathOrg2;
    //   client = await this.newGrpcConnection(this.peerEndpointOrg2, this.peerHostAliasOrg2);
    // } 
    else {
      throw new Error(`Unknown MSP ID: ${orgMspId}`);
    }

    const credentials = await fs.readFile(certPath);
    const privateKeyPem = await fs.readFile(keyPath);
    const privateKey = crypto.createPrivateKey(privateKeyPem);
    const signer = signers.newPrivateKeySigner(privateKey);

    const gateway = connect({
      identity: { mspId, credentials },
      signer,
      hash: hash.sha256,
      client,
    });

    this.logger.log(`Successfully connected to gateway as ${mspId}.`);
    return { gateway, client };
  }

  /**
   * Submits the CreateRecord transaction to the chaincode
   */
  async createRecord(payload: RecordPayload, orgMspId: OrgMspId): Promise<void> {
    this.logger.log(`Submitting 'CreateRecord' as ${orgMspId} for ID: ${payload.id}`);
    const { gateway, client } = await this.connect(orgMspId);
    try {
      const network = gateway.getNetwork(this.channelName);
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
      this.logger.log(`Transaction 'CreateRecord' committed successfully.`);
    } catch (error) {
      this.logger.error("Failed to submit 'CreateRecord' transaction", error);
      throw error;
    } finally {
      // --- FIX: USE .close() NOT .disconnect() ---
      gateway.close();
      client.close();
      this.logger.log('Disconnected from Fabric gateway (v4 client).');
    }
  }

  /**
   * Queries a record from the chaincode
   */
  async queryRecord(id: string, orgMspId: OrgMspId): Promise<string> {
    this.logger.log(`Evaluating 'QueryRecord' as ${orgMspId} for ID: ${id}`);
    const { gateway, client } = await this.connect(orgMspId);
    try {
      const network = gateway.getNetwork(this.channelName);
      const contract = network.getContract(this.chaincodeName);
      const resultBytes = await contract.evaluateTransaction('QueryRecord', id);
      const result = Buffer.from(resultBytes).toString('utf-8');
      this.logger.log(`Transaction 'QueryRecord' evaluated successfully.`);
      return result;
    } catch (error) {
      this.logger.error("Failed to evaluate 'QueryRecord' transaction", error);
      throw error;
    } finally {
      // --- FIX: USE .close() NOT .disconnect() ---
      gateway.close();
      client.close();
      this.logger.log('Disconnected from Fabric gateway (v4 client).');
    }
  }

  /**
   * --- FIX: ADDED NEW createPolicy FUNCTION (with correct v4 syntax) ---
   */
  async createPolicy(
    policyId: string,
    categoriesJSON: string,
    rulesJSON: string,
    orgMspId: OrgMspId,
  ): Promise<void> {
    this.logger.log(`Submitting 'CreatePolicy' as ${orgMspId} for ID: ${policyId}`);
    const { gateway, client } = await this.connect(orgMspId);

    try {
      const network = gateway.getNetwork(this.channelName);
      const contract = network.getContract(this.chaincodeName);

      await contract.submitTransaction(
        'CreatePolicy',
        policyId,
        categoriesJSON,
        rulesJSON,
      );

      this.logger.log(`Transaction 'CreatePolicy' committed successfully by ${orgMspId}.`);
    } catch (error) {
      this.logger.error(`Failed to submit 'CreatePolicy' as ${orgMspId}`, error);
      throw error;
    } finally {
      // --- FIX: USE .close() NOT .disconnect() ---
      gateway.close();
      client.close();
      this.logger.log('Disconnected from Fabric gateway (v4 client).');
    }
  }
}