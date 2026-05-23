import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../database/prisma.service';
interface GPSDataPayload {
    tripId: string;
    latitude: number;
    longitude: number;
    speedKmh: number;
    heading: number;
}
export declare class DispatchGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private prisma;
    server: Server;
    private readonly logger;
    private pingBuffer;
    private flushInterval;
    constructor(prisma: PrismaService);
    handleConnection(client: Socket): void;
    handleDisconnect(client: Socket): void;
    handleJoinTrip(client: Socket, data: {
        tripId: string;
    }): {
        status: string;
        room: string;
    };
    handleLeaveTrip(client: Socket, data: {
        tripId: string;
    }): {
        status: string;
    };
    handleGPSPing(client: Socket, data: GPSDataPayload): Promise<{
        error: string;
        status?: undefined;
    } | {
        status: string;
        error?: undefined;
    }>;
    private flushPingsToDatabase;
    destroy(): void;
}
export {};
