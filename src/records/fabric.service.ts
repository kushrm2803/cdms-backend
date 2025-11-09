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

type OrgMspId = 'Org1MSP' | 'Org2MSP';

export interface RecordPayload {
  id: string;
  caseId: string;
  recordType: string;
  fileHash: string;
  offChainUri: string;
  ownerOrg: string;
  createdAt: string;
  policyId: string;
}

@Injectable()
export class FabricService {
  private readonly logger = new Logger(FabricService.name);
  private readonly channelName = 'mychannel';
  private readonly chaincodeName = 'cdms-chaincode';
  private readonly mspIdOrg1 = 'Org1MSP';
  private readonly mspIdOrg2 = 'Org2MSP';
  
  // --- Org1 details ---
  private readonly peerEndpointOrg1 = 'localhost:7051';
  private readonly peerHostAliasOrg1 = 'peer0.org1.example.com';
  private readonly certPathOrg1 = path.resolve(__dirname, '..', '..', 'fabric-config', 'Admin@org1.example.com-cert.pem');
  private readonly keyPathOrg1 = path.resolve(__dirname, '..', '..', 'fabric-config', 'key.pem');
  // --- FIX: Path to Org1's trust cert
  private readonly tlsCertPathOrg1 = path.resolve(__dirname, '..', '..', 'fabric-config', 'tls-root-cert.pem');

  // --- Org2 details ---
  private readonly peerEndpointOrg2 = 'localhost:9051';
  private readonly peerHostAliasOrg2 = 'peer0.org2.example.com';
  private readonly certPathOrg2 = path.resolve(__dirname, '..', '..', 'fabric-config', 'Admin@org2.example.com-cert.pem');
  private readonly keyPathOrg2 = path.resolve(__dirname, '..', '..', 'fabric-config', 'key-org2.pem');
  // --- FIX: Path to Org2's trust cert
  private readonly tlsCertPathOrg2 = path.resolve(__dirname, '..', '..', 'fabric-config', 'tls-root-cert-org2.pem');

  /**
   * Creates a new gRPC connection to a peer
   */
  // --- FIX: Now takes the correct TLS cert path ---
  private async newGrpcConnection(
    peerEndpoint: string,
    peerHostAlias: string,
    tlsCertPath: string, // <-- ADDED THIS ARGUMENT
  ): Promise<grpc.Client> {
    const tlsRootCert = await fs.readFile(tlsCertPath); // <-- USES THE ARGUMENT
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
    
    let mspId: string;
    let certPath: string;
    let keyPath: string;
    let client: grpc.Client;

    if (orgMspId === 'Org1MSP') {
      mspId = this.mspIdOrg1;
      certPath = this.certPathOrg1;
      keyPath = this.keyPathOrg1;
      // --- FIX: Pass the correct TLS cert ---
      client = await this.newGrpcConnection(
        this.peerEndpointOrg1, 
        this.peerHostAliasOrg1, 
        this.tlsCertPathOrg1
      );
    } 
    else if (orgMspId === 'Org2MSP') {
      mspId = this.mspIdOrg2;
      certPath = this.certPathOrg2;
      keyPath = this.keyPathOrg2;
      // --- FIX: Pass the correct TLS cert ---
      client = await this.newGrpcConnection(
        this.peerEndpointOrg2, 
        this.peerHostAliasOrg2, 
        this.tlsCertPathOrg2
      );
    } 
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
   * Disconnects the gateway and gRPC client
   */
  private closeConnection(gateway: Gateway, client: grpc.Client): void {
    gateway.close();
    client.close();
    this.logger.log('Disconnected from Fabric gateway (v4 client).');
  }

  /**
   * Prepare chaincode args: ensure none are undefined and stringify non-strings.
   */
  private prepareArgs(args: any[]): string[] {
    return args.map((a, i) => {
      if (a === undefined || a === null) {
        throw new Error(`Undefined/null argument at position ${i} when preparing chaincode args: ${JSON.stringify(args)}`);
      }
      return typeof a === 'string' ? a : JSON.stringify(a);
    });
  }

  // ... (The rest of your file is PERFECT, keep createRecord, queryRecord, and createPolicy as they are) ...

  /**
   * Submits the CreateRecord transaction...
   */
  async createRecord(payload: RecordPayload, orgMspId: OrgMspId): Promise<void> {
    // ... (This function is correct, no changes needed) ...
    this.logger.log(`Submitting 'CreateRecord' as ${orgMspId} for ID: ${payload.id}`);
    const { gateway, client } = await this.connect(orgMspId);
    try {
      const network = gateway.getNetwork(this.channelName);
      const contract = network.getContract(this.chaincodeName);
      const txArgs = this.prepareArgs([
        payload.id,
        payload.caseId,
        payload.recordType,
        payload.fileHash,
        payload.offChainUri,
        payload.ownerOrg,
        payload.createdAt,
        payload.policyId,
      ]);
      await contract.submitTransaction('CreateRecord', ...txArgs);
      this.logger.log(`Transaction 'CreateRecord' committed successfully.`);
    } catch (error) {
      this.logger.error("Failed to submit 'CreateRecord' transaction", error);
      throw error;
    } finally {
      this.closeConnection(gateway, client);
    }
  }



  /**
   * Submits the CreatePolicy transaction...
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
      const txArgs = this.prepareArgs([policyId, categoriesJSON, rulesJSON]);
      await contract.submitTransaction('CreatePolicy', ...txArgs);
      this.logger.log(`Transaction 'CreatePolicy' committed successfully by ${orgMspId}.`);
    } catch (error) {
      this.logger.error(`Failed to submit 'CreatePolicy' as ${orgMspId}`, error);
      throw error;
    } finally {
      this.closeConnection(gateway, client);
    }
  }

  async queryRecordsByCase(caseId: string, orgMspId: OrgMspId): Promise<string> {
    this.logger.log(`Evaluating 'QueryRecordsByCase' as ${orgMspId} for case: ${caseId}`);
    const { gateway, client } = await this.connect(orgMspId);
    try {
      const network = gateway.getNetwork(this.channelName);
      const contract = network.getContract(this.chaincodeName);
  const evalArgs = this.prepareArgs([caseId]);
  const resultBytes = await contract.evaluateTransaction('QueryRecordsByCase', ...evalArgs);
      const result = Buffer.from(resultBytes).toString('utf-8');
      this.logger.log(`Transaction 'QueryRecordsByCase' evaluated successfully.`);
      return result;
    } catch (error) {
      this.logger.error("Failed to evaluate 'QueryRecordsByCase' transaction", error);
      throw error;
    } finally {
      this.closeConnection(gateway, client);
    }
  }

  async queryRecords(searchParams: any): Promise<string> {
    this.logger.log(`Evaluating 'QueryRecords' with params:`, searchParams);
    const { gateway, client } = await this.connect(searchParams.orgMspId);
    try {
      const network = gateway.getNetwork(this.channelName);
      const contract = network.getContract(this.chaincodeName);
      const evalArgs = this.prepareArgs([JSON.stringify(searchParams)]);
      const resultBytes = await contract.evaluateTransaction('QueryRecords', ...evalArgs);
      const result = Buffer.from(resultBytes).toString('utf-8');
      this.logger.log(`Transaction 'QueryRecords' evaluated successfully.`);
      return result;
    } catch (error) {
      this.logger.error("Failed to evaluate 'QueryRecords' transaction", error);
      throw error;
    } finally {
      this.closeConnection(gateway, client);
    }
  }

  async updateRecordMetadata(
    id: string,
    metadata: any,
    orgMspId: OrgMspId
  ): Promise<void> {
    this.logger.log(`Submitting 'UpdateRecordMetadata' as ${orgMspId} for ID: ${id}`);
    const { gateway, client } = await this.connect(orgMspId);
    try {
      const network = gateway.getNetwork(this.channelName);
      const contract = network.getContract(this.chaincodeName);
      const txArgs = this.prepareArgs([id, JSON.stringify(metadata)]);
      await contract.submitTransaction('UpdateRecordMetadata', ...txArgs);
      this.logger.log(`Transaction 'UpdateRecordMetadata' committed successfully.`);
    } catch (error) {
      this.logger.error("Failed to submit 'UpdateRecordMetadata' transaction", error);
      throw error;
    } finally {
      this.closeConnection(gateway, client);
    }
  }

  // --- Policy queries ---
  async queryPolicy(policyId: string, orgMspId: OrgMspId): Promise<string> {
    this.logger.log(`Evaluating 'QueryPolicy' as ${orgMspId} for ID: ${policyId}`);
    const { gateway, client } = await this.connect(orgMspId);
    try {
      const network = gateway.getNetwork(this.channelName);
      const contract = network.getContract(this.chaincodeName);
  const evalArgs = this.prepareArgs([policyId]);
  const resultBytes = await contract.evaluateTransaction('QueryPolicy', ...evalArgs);
      const result = Buffer.from(resultBytes).toString('utf-8');
      this.logger.log(`Transaction 'QueryPolicy' evaluated successfully.`);
      return result;
    } catch (error) {
      this.logger.error("Failed to evaluate 'QueryPolicy' transaction", error);
      throw error;
    } finally {
      this.closeConnection(gateway, client);
    }
  }

  async queryAllPolicies(orgMspId: OrgMspId): Promise<string> {
    this.logger.log(`Evaluating 'QueryAllPolicies' as ${orgMspId}`);
    const { gateway, client } = await this.connect(orgMspId);
    try {
      const network = gateway.getNetwork(this.channelName);
      const contract = network.getContract(this.chaincodeName);
  const resultBytes = await contract.evaluateTransaction('QueryAllPolicies');
      const result = Buffer.from(resultBytes).toString('utf-8');
      this.logger.log(`Transaction 'QueryAllPolicies' evaluated successfully.`);
      return result;
    } catch (error) {
      this.logger.error("Failed to evaluate 'QueryAllPolicies' transaction", error);
      throw error;
    } finally {
      this.closeConnection(gateway, client);
    }
  }

  // --- Organization queries ---
  async queryAllOrganizations(orgMspId: OrgMspId): Promise<string> {
    this.logger.log(`Evaluating 'QueryAllOrganizations' as ${orgMspId}`);
    const { gateway, client } = await this.connect(orgMspId);
    try {
      const network = gateway.getNetwork(this.channelName);
      const contract = network.getContract(this.chaincodeName);
  const resultBytes = await contract.evaluateTransaction('QueryAllOrganizations');
      const result = Buffer.from(resultBytes).toString('utf-8');
      this.logger.log(`Transaction 'QueryAllOrganizations' evaluated successfully.`);
      return result;
    } catch (error) {
      this.logger.error("Failed to evaluate 'QueryAllOrganizations' transaction", error);
      throw error;
    } finally {
      this.closeConnection(gateway, client);
    }
  }

  async queryOrganizationMembers(orgId: string, orgMspId: OrgMspId): Promise<string> {
    this.logger.log(`Evaluating 'QueryOrganizationMembers' as ${orgMspId} for org: ${orgId}`);
    const { gateway, client } = await this.connect(orgMspId);
    try {
      const network = gateway.getNetwork(this.channelName);
      const contract = network.getContract(this.chaincodeName);
  const evalArgs = this.prepareArgs([orgId]);
  const resultBytes = await contract.evaluateTransaction('QueryOrganizationMembers', ...evalArgs);
      const result = Buffer.from(resultBytes).toString('utf-8');
      this.logger.log(`Transaction 'QueryOrganizationMembers' evaluated successfully.`);
      return result;
    } catch (error) {
      this.logger.error("Failed to evaluate 'QueryOrganizationMembers' transaction", error);
      throw error;
    } finally {
      this.closeConnection(gateway, client);
    }
  }

  // --- User operations ---
  async createUser(
    username: string,
    fullName: string,
    email: string,
    role: string,
    organization: string,
    passwordHash: string,
    orgMspId: OrgMspId,
  ): Promise<void> {
    this.logger.log(`Submitting 'CreateUser' as ${orgMspId} for username: ${username}`);
    const { gateway, client } = await this.connect(orgMspId);
    try {
      const network = gateway.getNetwork(this.channelName);
      const contract = network.getContract(this.chaincodeName);
      // Include the passwordHash in the chaincode call so chaincode can store or verify it securely
  const txArgs = this.prepareArgs([username, fullName, email, role, organization, passwordHash]);
  await contract.submitTransaction('CreateUser', ...txArgs);
      this.logger.log(`Transaction 'CreateUser' committed successfully.`);
    } catch (error) {
      this.logger.error("Failed to submit 'CreateUser' transaction", error);
      throw error;
    } finally {
      this.closeConnection(gateway, client);
    }
  }

  async queryUser(username: string, orgMspId: OrgMspId): Promise<string> {
    this.logger.log(`Evaluating 'QueryUser' as ${orgMspId} for username: ${username}`);
    const { gateway, client } = await this.connect(orgMspId);
    try {
      const network = gateway.getNetwork(this.channelName);
      const contract = network.getContract(this.chaincodeName);
  const evalArgs = this.prepareArgs([username]);
  const resultBytes = await contract.evaluateTransaction('QueryUser', ...evalArgs);
      const result = Buffer.from(resultBytes).toString('utf-8');
      this.logger.log(`Transaction 'QueryUser' evaluated successfully.`);
      return result;
    } catch (error) {
      this.logger.error("Failed to evaluate 'QueryUser' transaction", error);
      throw error;
    } finally {
      this.closeConnection(gateway, client);
    }
  }

  // --- Case operations ---
  async createCase(
    id: string,
    title: string,
    description: string,
    jurisdiction: string,
    caseType: string,
    orgMspId: OrgMspId,
  ): Promise<void> {
    this.logger.log(`Submitting 'CreateCase' as ${orgMspId} for ID: ${id}`);
    const { gateway, client } = await this.connect(orgMspId);
    try {
      const network = gateway.getNetwork(this.channelName);
      const contract = network.getContract(this.chaincodeName);
  const txArgs = this.prepareArgs([id, title, description, jurisdiction, caseType]);
  await contract.submitTransaction('CreateCase', ...txArgs);
      this.logger.log(`Transaction 'CreateCase' committed successfully.`);
    } catch (error) {
      this.logger.error("Failed to submit 'CreateCase' transaction", error);
      throw error;
    } finally {
      this.closeConnection(gateway, client);
    }
  }

  async queryRecord(id: string, orgMspId: OrgMspId, userRole?: string): Promise<string> {
    this.logger.log(`Evaluating 'QueryRecord' as ${orgMspId} (role: ${userRole}) for ID: ${id}`);
    const { gateway, client } = await this.connect(orgMspId);
    try {
      const network = gateway.getNetwork(this.channelName);
      const contract = network.getContract(this.chaincodeName);
      const evalArgs = this.prepareArgs([id, userRole || '']);
      const resultBytes = await contract.evaluateTransaction('QueryRecord', ...evalArgs);
      const result = Buffer.from(resultBytes).toString('utf-8');
      this.logger.log(`Transaction 'QueryRecord' evaluated successfully.`);
      return result;
    } catch (error) {
      this.logger.error("Failed to evaluate 'QueryCase' transaction", error);
      throw error;
    } finally {
      this.closeConnection(gateway, client);
    }
  }

  async queryAllCases(filtersJSON: string, orgMspId: OrgMspId): Promise<string> {
    this.logger.log(`Evaluating 'QueryAllCases' as ${orgMspId} with filters`);
    const { gateway, client } = await this.connect(orgMspId);
    try {
      const network = gateway.getNetwork(this.channelName);
      const contract = network.getContract(this.chaincodeName);
  const evalArgs = this.prepareArgs([filtersJSON]);
  const resultBytes = await contract.evaluateTransaction('QueryAllCases', ...evalArgs);
      const result = Buffer.from(resultBytes).toString('utf-8');
      this.logger.log(`Transaction 'QueryAllCases' evaluated successfully.`);
      return result;
    } catch (error) {
      this.logger.error("Failed to evaluate 'QueryAllCases' transaction", error);
      throw error;
    } finally {
      this.closeConnection(gateway, client);
    }
  }

  async deleteCase(id: string, orgMspId: OrgMspId): Promise<void> {
    this.logger.log(`Submitting 'DeleteCase' as ${orgMspId} for ID: ${id}`);
    const { gateway, client } = await this.connect(orgMspId);
    try {
      const network = gateway.getNetwork(this.channelName);
      const contract = network.getContract(this.chaincodeName);
      const txArgs = this.prepareArgs([id]);
      await contract.submitTransaction('DeleteCase', ...txArgs);
      this.logger.log(`Transaction 'DeleteCase' committed successfully.`);
    } catch (error) {
      this.logger.error("Failed to submit 'DeleteCase' transaction", error);
      throw error;
    } finally {
      this.closeConnection(gateway, client);
    }
  }

  /**
   * Queries a case from the chaincode
   */
  async queryCase(id: string, orgMspId: OrgMspId): Promise<string> {
    this.logger.log(`Evaluating 'QueryCase' as ${orgMspId} for ID: ${id}`);
    const { gateway, client } = await this.connect(orgMspId);
    try {
      const network = gateway.getNetwork(this.channelName);
      const contract = network.getContract(this.chaincodeName);
      const evalArgs = this.prepareArgs([id]);
      const resultBytes = await contract.evaluateTransaction('QueryCase', ...evalArgs);
      const result = Buffer.from(resultBytes).toString('utf-8');
      this.logger.log(`Transaction 'QueryCase' evaluated successfully.`);
      return result;
    } catch (error) {
      this.logger.error("Failed to evaluate 'QueryCase' transaction", error);
      throw error;
    } finally {
      this.closeConnection(gateway, client);
    }
  }
}