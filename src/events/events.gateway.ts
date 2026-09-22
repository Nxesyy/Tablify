import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { EventsService } from './events.service.js';
import { OnModuleInit } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class EventsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleInit
{
  @WebSocketServer()
  server: Server;

  constructor(private readonly eventsService: EventsService) {}

  onModuleInit() {
    // Dengarkan event dari service dan broadcast ke socket
    this.eventsService.getEventStream().subscribe((event) => {
      if (this.server) {
        // Broadcast global
        this.server.emit('realtime_event', event);
        this.server.emit(event.type, event.payload);

        // Jika event memiliki id_owner, broadcast juga ke room gerai spesifik
        if (event.payload?.id_owner) {
          this.server.to(`gerai_${event.payload.id_owner}`).emit(event.type, event.payload);
        }
      }
    });
  }

  afterInit() {
    console.log('⚡ Realtime WebSocket Gateway Initialized');
  }

  handleConnection(client: Socket) {
    console.log(`🔌 Client connected to WebSocket: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`❌ Client disconnected from WebSocket: ${client.id}`);
  }

  @SubscribeMessage('join_room')
  handleJoinRoom(
    @MessageBody() roomName: string,
    @ConnectedSocket() client: Socket,
  ) {
    client.join(roomName);
    return { event: 'joined_room', data: roomName };
  }

  @SubscribeMessage('leave_room')
  handleLeaveRoom(
    @MessageBody() roomName: string,
    @ConnectedSocket() client: Socket,
  ) {
    client.leave(roomName);
    return { event: 'left_room', data: roomName };
  }
}
