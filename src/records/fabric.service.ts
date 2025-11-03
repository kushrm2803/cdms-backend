import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Gateway, GatewayOptions, Wallets } from 'fabric-network';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class FabricService {
  private readonly logger = new Logger(FabricService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Connects to the Fabric gateway using the 'appUser' identity.
   */
  private async connect(): Promise<Gateway> {
    // 1. Setup the wallet
    const walletPath = path.resolve(
      __dirname,
      '..',
      '..',
      'fabric-config',
      'wallet',
    );
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

    // 3. Define the identity to use (THE FIX)
    // We use 'appUser', which was properly registered and enrolled.
    const identity = 'appUser';

    this.logger.log(`--- VERIFYING IDENTITY: ${identity} ---`);
    // 4. Check if 'appUser' identity exists in the wallet
    const identityExists = await wallet.get(identity);
    if (!identityExists) {
      this.logger.error(`Identity ${identity} not found in wallet.`);
      this.logger.error(
        'Please ensure you have run enrollAdmin.js and registerUser.js from the fabcar/javascript sample',
      );
      throw new Error('Failed to setup Fabric identity.');
    }

    // 5. Define the gateway connection options
    const gatewayOptions: GatewayOptions = {
      wallet,
      identity: identity,
      discovery: {
        enabled: false,
        asLocalhost: false,
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
   * It calls the 'QueryAllCars' function on the 'fabcar' chaincode.
   */
  async testConnection(): Promise<string> {
    this.logger.log('Testing Fabric connection...');
    let gateway: Gateway | undefined = undefined;

    try {
      // Connect and get the contract
      gateway = await this.connect();
      const network = await gateway.getNetwork('mychannel');
      const contract = network.getContract('fabcar');

      // Call the 'QueryAllCars' function
      this.logger.log("Evaluating 'QueryAllCars' transaction...");
      const result = await contract.evaluateTransaction('QueryAllCars');

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

  // You can add your other chaincode functions here,
  // for example, 'createRecord', 'queryRecord', etc.
  //
  // async createRecord(id: string, data: string) {
  //   const gateway = await this.connect();
  //   const network = await gateway.getNetwork('mychannel');
  //   const contract = network.getContract('fabcar');
  //   await contract.submitTransaction('CreateCar', id, data...);
  //   gateway.disconnect();
  // }
}