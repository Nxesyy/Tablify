import { Module } from '@nestjs/common';
import { AdminService } from './admin.service.js';
import { AdminController } from './admin.controller.js';
import { ExportReportService } from './export-report.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SpacesModule } from '../spaces/spaces.module.js';
import { DiskonModule } from '../diskon/diskon.module.js';
import { ReservasiModule } from '../reservasi/reservasi.module.js';

@Module({
  imports: [SpacesModule, DiskonModule, ReservasiModule],
  controllers: [AdminController],
  providers: [AdminService, ExportReportService],
  exports: [AdminService, ExportReportService],
})
export class AdminModule {}

