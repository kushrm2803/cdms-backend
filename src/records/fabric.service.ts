import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Gateway,
  GatewayOptions,
  Wallets,
} from 'fabric-network'; // <-- Import Fabric classes
import * as path from 'path'; // <-- Import Node.js path
import * as fs from 'fs'; // <-- Import Node.js file system

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

    // Check if the identity exists
    if (!wallet.get(identity)) {
      this.logger.error(`Identity ${identity} not found in wallet`);
      throw new Error(`Identity ${identity} not found in wallet`);
    }

    // 4. Define the gateway connection options
    const gatewayOptions: GatewayOptions = {
      wallet,
      identity: identity,
      discovery: {
        enabled: true,
        asLocalhost: true, // This is key for connecting Windows -> WSL 2
      },
    };

    // 5. Connect to the gateway
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
    
    // --- THIS IS THE FIX ---
    // Initialize 'gateway' as undefined so TypeScript knows it can be
    // in that state in the 'finally' block.
    let gateway: Gateway | undefined = undefined;
    // --- END OF FIX ---

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