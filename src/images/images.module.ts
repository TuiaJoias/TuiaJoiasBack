import { Module } from '@nestjs/common';
import { ImageProcessorService } from './image-processor.service.js';

@Module({
  providers: [ImageProcessorService],
  exports: [ImageProcessorService],
})
export class ImagesModule {}
