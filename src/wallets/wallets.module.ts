import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WalletsService } from './wallets.service';
import { WalletsController } from './wallets.controller';

@Module({
  imports: [AuthModule],
  providers: [WalletsService],
  controllers: [WalletsController],
})
export class WalletsModule {}
