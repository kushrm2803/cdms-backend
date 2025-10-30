import { Module } from '@nestjs/common';
import { RecordsService } from './records.service';
import { RecordsController } from './records.controller';
import { MinioService } from './minio.service';
import { VaultService } from './vault.service';

@Module({
  controllers: [RecordsController],
  providers: [
    RecordsService,
    MinioService,
    VaultService,
  ],
})
export class RecordsModule {}
