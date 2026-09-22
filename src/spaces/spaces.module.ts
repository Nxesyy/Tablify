import { Module } from '@nestjs/common';
import { SpacesService } from './spaces.service.js';
import { SpacesController } from './spaces.controller.js';

@Module({
  controllers: [SpacesController],
  providers: [SpacesService],
  exports: [SpacesService],
})
export class SpacesModule {}
