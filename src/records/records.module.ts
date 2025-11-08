import { Module } from '@nestjs/common';
import { RecordsService } from './records.service';
import { RecordsController } from './records.controller';
import { MinioService } from './minio.service';
import { VaultService } from './vault.service';
import { FabricService } from './fabric.service';

@Module({
  controllers: [RecordsController],
  providers: [
    RecordsService,
    MinioService,
    VaultService,
    FabricService,
  ],
  exports: [
    FabricService,
    MinioService,
    VaultService,
  ],
})
export class RecordsModule {}
