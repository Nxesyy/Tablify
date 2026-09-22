import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SchedulerService } from './scheduler.service.js';
import { ReminderNotificationService } from './reminder-notification.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [SchedulerService, ReminderNotificationService],
  exports: [SchedulerService, ReminderNotificationService],
})
export class SchedulerModule {}
