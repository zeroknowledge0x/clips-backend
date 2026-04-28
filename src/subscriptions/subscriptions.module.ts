import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { StellarPaymentService } from './stellar-payment.service';
import { StellarWebhookService } from './stellar-webhook.service';
import { SubscriptionsController } from './subscriptions.controller';
import { StellarWebhookController } from './stellar-webhook.controller';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [SubscriptionsController, StellarWebhookController],
  providers: [StellarPaymentService, StellarWebhookService],
  exports: [StellarPaymentService, StellarWebhookService],
})
export class SubscriptionsModule {}
