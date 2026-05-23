import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  /**
   * Client registers their userId so they can receive targeted events.
   * Usage: socket.emit('register', userId)
   */
  @SubscribeMessage('register')
  handleRegister(client: Socket, userId: string) {
    void client.join(`user:${userId}`);
    console.log(`User ${userId} joined room user:${userId}`);
  }

  /** Broadcast a data-change event to all connected clients */
  emitDataChange(event: string, data: unknown) {
    this.server.emit(event, data);
    this.server.emit('dataChanged', { event, data });
  }

  /** Send an event to a specific user's room */
  emitToUser(userId: string, event: string, data: unknown) {
    this.server.to(`user:${userId}`).emit(event, data);
  }
}
