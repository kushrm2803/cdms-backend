import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Gateway,
  GatewayOptions,
  Wallets,
  X509Identity, // <-- Import this
} from 'fabric-network';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class FabricService {
  private readonly logger = new Logger(FabricService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Connects to the Fabric gateway
   * @returns A connected gateway, the network, and the contract
   */
  private async connect() {
    // 1. Setup the wallet
    const walletPath = path.resolve(__dirname, '..', '..', 'fabric-config', 'wallet');
    const wallet = await Wallets.newFileSystemWallet(walletPath);
    this.logger.log(`Wallet path: ${walletPath}`);

    // 2. Setup the connection profile (the "map")
    const ccpPath = path.resolve(
      __dirname,
      '..',
      '..',
      'fabric-config',
      'connection-org1.json',
    );
    const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));

    // 3. Define the identity to use (our "ID card")
    const identity = 'Admin@org1.example.com';

    // 4. --- THIS IS THE FIX ---
    // Check if identity exists. If not, create it from our copied msp files.
    const identityExists = await wallet.get(identity);
    if (!identityExists) {
      this.logger.warn(`Identity ${identity} not found. Attempting to import from msp...`);

      try {
        // Read the cert
        const certPath = path.resolve(
          walletPath,
          'msp',
          'signcerts',
          'Admin@org1.example.com-cert.pem',
        );
        if (!fs.existsSync(certPath)) {
          throw new Error(`Certificate not found: ${certPath}`);
        }
        const certificate = fs.readFileSync(certPath, 'utf8');

        // Read the key
        const keyDir = path.resolve(walletPath, 'msp', 'keystore');
        const keyFiles = fs.readdirSync(keyDir);
        const keyFile = keyFiles.find((file) => file.endsWith('_sk'));
        if (!keyFile) {
          throw new Error(`Private key not found in ${keyDir}`);
        }
        const keyPath = path.resolve(keyDir, keyFile);
        const privateKey = fs.readFileSync(keyPath, 'utf8');

        // Create the identity object
        const mspId = 'Org1MSP'; // We know this from test-network
        const newIdentity: X509Identity = {
          credentials: { certificate, privateKey },
          mspId: mspId,
          type: 'X.509',
        };

        // Import the identity into the wallet
        await wallet.put(identity, newIdentity);
        this.logger.log(`Successfully imported identity ${identity} into wallet.`);
      } catch (importError) {
        this.logger.error('Failed to import identity from msp', importError);
        throw new Error('Failed to setup Fabric identity.');
      }
    }
    // --- END OF FIX ---

    // 5. Define the gateway connection options
    const gatewayOptions: GatewayOptions = {
      wallet,
      identity: identity,
      discovery: {
        enabled: true,
        asLocalhost: true, // This is key for connecting Windows -> WSL 2
      },
    };

    // 6. Connect to the gateway
    const gateway = new Gateway();
    this.logger.log('Connecting to Fabric gateway...');
    await gateway.connect(ccp, gatewayOptions);
    this.logger.log('Successfully connected to gateway.');

    return gateway;
  }

  /**
   * This is a simple test function.
   * It calls the 'GetAllAssets' function on the 'basic' chaincode.
   * This proves our entire connection (map, ID card) works.
   */
  async testConnection(): Promise<string> {
    this.logger.log('Testing Fabric connection...');
    let gateway: Gateway | undefined = undefined;

    try {
      // Connect and get the contract
      gateway = await this.connect();
      const network = await gateway.getNetwork('mychannel');
      const contract = network.getContract('basic');

      // Call the 'GetAllAssets' function
      this.logger.log("Evaluating 'GetAllAssets' transaction...");
      const result = await contract.evaluateTransaction('GetAllAssets');

      this.logger.log('Fabric test successful. Result:', result.toString());
      return result.toString();
    } catch (error) {
      this.logger.error('Failed to test Fabric connection', error);
      throw error;
    } finally {
      // Always disconnect the gateway
      if (gateway) {
        await gateway.disconnect();
        this.logger.log('Disconnected from Fabric gateway.');
      }
    }
  }
}