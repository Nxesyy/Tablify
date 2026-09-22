import { Module, Global } from '@nestjs/common';
import { EventsService } from './events.service.js';
import { EventsGateway } from './events.gateway.js';
import { EventsController } from './events.controller.js';

@Global()
@Module({
  controllers: [EventsController],
  providers: [EventsService, EventsGateway],
  exports: [EventsService, EventsGateway],
})
export class EventsModule {}
