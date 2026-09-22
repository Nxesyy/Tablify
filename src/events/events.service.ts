import { Injectable } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';

export interface RealtimeEvent {
  type: 'RESERVATION_CREATED' | 'RESERVATION_STATUS_CHANGED' | 'SPACE_UPDATED' | 'CHECK_IN' | 'CHECK_OUT';
  payload: any;
  timestamp: string;
}

@Injectable()
export class EventsService {
  private readonly eventSubject = new Subject<RealtimeEvent>();

  /**
   * Pancarkan event real-time ke seluruh subscriber (WebSocket & SSE)
   */
  emit(type: RealtimeEvent['type'], payload: any) {
    const event: RealtimeEvent = {
      type,
      payload,
      timestamp: new Date().toISOString(),
    };
    this.eventSubject.next(event);
  }

  /**
   * Aliran observable stream untuk SSE & WebSocket Gateway
   */
  getEventStream(): Observable<RealtimeEvent> {
    return this.eventSubject.asObservable();
  }
}
