"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var DispatchGateway_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DispatchGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../database/prisma.service");
let DispatchGateway = DispatchGateway_1 = class DispatchGateway {
    constructor(prisma) {
        this.prisma = prisma;
        this.logger = new common_1.Logger(DispatchGateway_1.name);
        this.pingBuffer = [];
        this.flushInterval = setInterval(() => this.flushPingsToDatabase(), 15000);
    }
    handleConnection(client) {
        this.logger.log(`GPS Terminal / Operator connected: ${client.id}`);
    }
    handleDisconnect(client) {
        this.logger.log(`GPS Terminal disconnected: ${client.id}`);
    }
    handleJoinTrip(client, data) {
        client.join(`trip_${data.tripId}`);
        this.logger.log(`Socket ${client.id} joined tracking room: trip_${data.tripId}`);
        return { status: 'joined', room: `trip_${data.tripId}` };
    }
    handleLeaveTrip(client, data) {
        client.leave(`trip_${data.tripId}`);
        this.logger.log(`Socket ${client.id} left tracking room: trip_${data.tripId}`);
        return { status: 'left' };
    }
    async handleGPSPing(client, data) {
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
        this.server.to(`trip_${tripId}`).emit('locationUpdated', pingRecord);
        this.server.emit('globalTrackerUpdate', pingRecord);
        this.pingBuffer.push(pingRecord);
        return { status: 'received' };
    }
    async flushPingsToDatabase() {
        if (this.pingBuffer.length === 0)
            return;
        const itemsToFlush = [...this.pingBuffer];
        this.pingBuffer = [];
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
            for (const ping of itemsToFlush) {
            }
        }
        catch (err) {
            this.logger.error('Failed to flush GPS coordinates batch:', err);
            this.pingBuffer.push(...itemsToFlush);
        }
    }
    destroy() {
        if (this.flushInterval) {
            clearInterval(this.flushInterval);
        }
    }
};
exports.DispatchGateway = DispatchGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], DispatchGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('joinTrip'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], DispatchGateway.prototype, "handleJoinTrip", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('leaveTrip'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], DispatchGateway.prototype, "handleLeaveTrip", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('submitGPSPing'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], DispatchGateway.prototype, "handleGPSPing", null);
exports.DispatchGateway = DispatchGateway = DispatchGateway_1 = __decorate([
    (0, websockets_1.WebSocketGateway)({
        cors: {
            origin: '*',
        },
        namespace: 'dispatch',
    }),
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], DispatchGateway);
//# sourceMappingURL=dispatch.gateway.js.map