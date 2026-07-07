import { Module } from '@nestjs/common';

import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';

import { MediaController } from './media.controller';
import { MediaRepository } from './media.repository';
import { MediaService } from './media.service';
import { ImageProcessingProcessor } from './queue/image-processing.processor';
import { ImageProcessingQueue } from './queue/image-processing.queue';

@Module({
  controllers: [MediaController],
  providers: [
    MediaService,
    MediaRepository,
    JwtAuthGuard,
    ImageProcessingQueue,
    ImageProcessingProcessor,
  ],
  exports: [MediaService, MediaRepository, ImageProcessingQueue],
})
export class MediaModule {}
