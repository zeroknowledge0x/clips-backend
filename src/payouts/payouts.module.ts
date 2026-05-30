import { Module } from '@nestjs/common';
import { PayoutsService } from './payouts.service';
import { PayoutsController } from './payouts.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { StellarModule } from '../stellar/stellar.module';
import { EarningsModule } from '../earnings/earnings.module';

@Module({
  imports: [PrismaModule, StellarModule, EarningsModule],
  controllers: [PayoutsController],
  providers: [PayoutsService],
  exports: [PayoutsService],
})
export class PayoutsModule {}
