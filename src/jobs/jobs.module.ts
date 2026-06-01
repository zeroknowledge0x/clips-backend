import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import {
  CLIP_GENERATION_QUEUE,
  CLIP_GENERATION_QUEUE_PRIORITY,
} from '../clips/clip-generation.queue';

@Module({
  imports: [
    BullModule.registerQueue({
      name: CLIP_GENERATION_QUEUE,
      defaultJobOptions: { priority: CLIP_GENERATION_QUEUE_PRIORITY },
    }),
  ],
  controllers: [JobsController],
  providers: [JobsService],
})
export class JobsModule {}
