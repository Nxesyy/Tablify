import { Module } from '@nestjs/common';
import { ReservasiService } from './reservasi.service.js';
import { ReservasiController } from './reservasi.controller.js';

@Module({
  controllers: [ReservasiController],
  providers: [ReservasiService],
})
export class ReservasiModule {}
