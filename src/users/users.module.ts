import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { RecordsModule } from '../records/records.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [RecordsModule, AuthModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
