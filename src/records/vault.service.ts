import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Vault, { client } from 'node-vault'; 

@Injectable()
export class VaultService {
  private readonly logger = new Logger(VaultService.name);
  private readonly vault: client;
  private readonly keyName = 'cdms-records-key';

  constructor(private readonly configService: ConfigService) {
    const vaultAddr = this.configService.getOrThrow<string>('VAULT_ADDR');
    const vaultToken = this.configService.getOrThrow<string>('VAULT_TOKEN');

    this.vault = Vault({
      endpoint: vaultAddr,
      token: vaultToken,
    });

    this.logger.log('Vault Service Initialized. Endpoint: ' + vaultAddr);
  }

  /**
   * Encrypts a buffer of data using Vault's transit engine.
   * @param data The plaintext data (as a Buffer)
   * @returns The encrypted string (ciphertext)
   */
  async encrypt(data: Buffer): Promise<string> {
    // Vault transit needs the data to be base64 encoded
    const plaintext = data.toString('base64');

    const response = await this.vault.write(`transit/encrypt/${this.keyName}`, {
      plaintext: plaintext,
    });

    return response.data.ciphertext;
  }

  /**
   * Decrypts ciphertext from Vault's transit engine.
   * @param ciphertext The encrypted string (from the file)
   * @returns The plaintext data (as a Buffer)
   */
  async decrypt(ciphertext: string): Promise<Buffer> {
    const response = await this.vault.write(`transit/decrypt/${this.keyName}`, {
      ciphertext: ciphertext,
    });

    // Vault returns the plaintext as base64, so we must decode it
    return Buffer.from(response.data.plaintext, 'base64');
  }
}