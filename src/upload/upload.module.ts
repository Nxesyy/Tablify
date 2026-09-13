import { Module } from '@nestjs/common';
import { UploadService } from './upload.service.js';
import { UploadController } from './upload.controller.js';

@Module({
  controllers: [UploadController],
  providers: [UploadService],
})
export class UploadModule {}
