import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

interface GPSDataPayload {
  tripId: string;
  latitude: number;
  longitude: number;
  speedKmh: number;
  heading: number;
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: 'dispatch',
})
@Injectable()
export class DispatchGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(DispatchGateway.name);
  
  // Buffered logs writing mechanism for heavy vehicle pings
  private pingBuffer: Array<GPSDataPayload & { timestamp: Date }> = [];
  private flushInterval: NodeJS.Timeout;

  constructor(private prisma: PrismaService) {
    // Start flush scheduler every 15 seconds to batch inserts in one transaction
    this.flushInterval = setInterval(() => this.flushPingsToDatabase(), 15000);
  }

  handleConnection(client: Socket) {
    this.logger.log(`GPS Terminal / Operator connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`GPS Terminal disconnected: ${client.id}`);
  }

  @SubscribeMessage('joinTrip')
  handleJoinTrip(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { tripId: string },
  ) {
    client.join(`trip_${data.tripId}`);
    this.logger.log(`Socket ${client.id} joined tracking room: trip_${data.tripId}`);
    return { status: 'joined', room: `trip_${data.tripId}` };
  }

  @SubscribeMessage('leaveTrip')
  handleLeaveTrip(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { tripId: string },
  ) {
    client.leave(`trip_${data.tripId}`);
    this.logger.log(`Socket ${client.id} left tracking room: trip_${data.tripId}`);
    return { status: 'left' };
  }

  @SubscribeMessage('submitGPSPing')
  async handleGPSPing(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: GPSDataPayload,
  ) {
    const { tripId, latitude, longitude, speedKmh, heading } = data;
    
    if (!tripId || latitude === undefined || longitude === undefined) {
      return { error: 'Invalid payload' };
    }

    const pingRecord = {
      tripId,
      latitude,
      longitude,
      speedKmh,
      heading,
      timestamp: new Date(),
    };

    // 1. Broadcast immediate coordinate update to dashboard rooms tracking this active trip
    this.server.to(`trip_${tripId}`).emit('locationUpdated', pingRecord);
    this.server.emit('globalTrackerUpdate', pingRecord); // Global dispatcher feed

    // 2. Queue into write-buffer
    this.pingBuffer.push(pingRecord);

    return { status: 'received' };
  }

  // Batch insert optimization to prevent PostgreSQL thread locking
  private async flushPingsToDatabase() {
    if (this.pingBuffer.length === 0) return;

    const itemsToFlush = [...this.pingBuffer];
    this.pingBuffer = []; // Reset queue

    this.logger.log(`Flushing ${itemsToFlush.length} GPS coordinates to Postgres database...`);

    try {
      await this.prisma.gPSPing.createMany({
        data: itemsToFlush.map(p => ({
          tripId: p.tripId,
          latitude: p.latitude,
          longitude: p.longitude,
          speedKmh: p.speedKmh,
          heading: p.heading,
          timestamp: p.timestamp,
        })),
      });
      
      // Proactive geofencing: check if final ping is near destination to trigger auto check-ins
      for (const ping of itemsToFlush) {
        // Find if any active trip needs automatic arrival updates (simple geofence mock)
        // In real system, query coordinates vs destination postgis point
      }
    } catch (err) {
      this.logger.error('Failed to flush GPS coordinates batch:', err);
      // Re-inject pings if writing failed
      this.pingBuffer.push(...itemsToFlush);
    }
  }

  // Clean-up hooks
  destroy() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
  }
}
