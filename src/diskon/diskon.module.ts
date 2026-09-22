import { Module } from '@nestjs/common';
import { DiskonService } from './diskon.service.js';
import { DiskonController } from './diskon.controller.js';

@Module({
  controllers: [DiskonController],
  providers: [DiskonService],
  exports: [DiskonService],
})
export class DiskonModule {}
