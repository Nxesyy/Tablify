import { Controller, Sse, MessageEvent } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { EventsService } from './events.service.js';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  /**
   * Endpoint Server-Sent Events (SSE)
   * Browser dapat menghubungkan EventSource('/events/stream') untuk stream live real-time
   */
  @Sse('stream')
  stream(): Observable<MessageEvent> {
    return this.eventsService.getEventStream().pipe(
      map((event) => ({
        data: event,
      })),
    );
  }
}
