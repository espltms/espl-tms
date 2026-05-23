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
Object.defineProperty(exports, "__esModule", { value: true });
exports.TripController = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../infrastructure/database/prisma.service");
const jwt_auth_guard_1 = require("../../infrastructure/security/jwt-auth.guard");
const roles_guard_1 = require("../../infrastructure/security/roles.guard");
const roles_decorator_1 = require("../../infrastructure/security/roles.decorator");
const client_1 = require("@prisma/client");
let TripController = class TripController {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getTrips(status) {
        return this.prisma.trip.findMany({
            where: status ? { status } : {},
            include: {
                driver: { select: { fullName: true, phone: true } },
                truck: { select: { plateNumber: true, model: true } },
                purchaseOrder: { select: { poNumber: true, clientName: true, commodity: true } },
                vendor: { select: { name: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    async getTripById(id) {
        const trip = await this.prisma.trip.findUnique({
            where: { id },
            include: {
                driver: true,
                truck: true,
                purchaseOrder: true,
                vendor: true,
                gatepasses: true,
                expenses: {
                    include: { approvedBy: { select: { fullName: true } } }
                },
                invoices: true,
                gpsPings: {
                    orderBy: { timestamp: 'desc' },
                    take: 50,
                },
            },
        });
        if (!trip) {
            throw new common_1.BadRequestException('Trip not found');
        }
        return trip;
    }
    async createTrip(body, req) {
        const { purchaseOrderId, driverId, truckId, vendorId, source, destination, distanceKm, estimatedQuantityTons, scheduledStartDate, } = body;
        if (!purchaseOrderId || !driverId || !truckId || !source || !destination || !estimatedQuantityTons) {
            throw new common_1.BadRequestException('Missing required trip assignment parameters');
        }
        return this.prisma.$transaction(async (tx) => {
            const po = await tx.purchaseOrder.findUnique({
                where: { id: purchaseOrderId },
            });
            if (!po || po.status !== 'ACTIVE') {
                throw new common_1.BadRequestException('Selected Purchase Order is invalid or inactive');
            }
            const currentAllocated = Number(po.allocatedQuantityTons);
            const limit = Number(po.totalQuantityTons);
            const newAllocation = currentAllocated + Number(estimatedQuantityTons);
            if (newAllocation > limit) {
                throw new common_1.BadRequestException(`Insufficient remaining capacity on PO ${po.poNumber}. Available: ${limit - currentAllocated} tons, Requested: ${estimatedQuantityTons} tons`);
            }
            const driver = await tx.driver.findUnique({ where: { id: driverId } });
            if (!driver || driver.status !== 'AVAILABLE' || !driver.complianceVerified) {
                throw new common_1.BadRequestException('Driver is not available or has non-compliant active records');
            }
            const truck = await tx.truck.findUnique({ where: { id: truckId } });
            if (!truck || truck.status !== 'AVAILABLE' || !truck.complianceVerified) {
                throw new common_1.BadRequestException('Truck is not available or vehicle registration is expired');
            }
            await tx.purchaseOrder.update({
                where: { id: purchaseOrderId },
                data: { allocatedQuantityTons: newAllocation },
            });
            await tx.driver.update({
                where: { id: driverId },
                data: { status: 'ON_TRIP' },
            });
            await tx.truck.update({
                where: { id: truckId },
                data: { status: 'ON_TRIP' },
            });
            const tripCount = await tx.trip.count();
            const tripNumber = `TRIP-${10000 + tripCount + 1}`;
            const trip = await tx.trip.create({
                data: {
                    tripNumber,
                    purchaseOrderId,
                    driverId,
                    truckId,
                    vendorId: vendorId || null,
                    source,
                    destination,
                    distanceKm: Number(distanceKm),
                    estimatedQuantityTons: Number(estimatedQuantityTons),
                    scheduledStartDate: new Date(scheduledStartDate),
                    status: client_1.TripStatus.SCHEDULED,
                },
            });
            await tx.auditLog.create({
                data: {
                    userId: req.user.id,
                    action: 'TRIP_CREATED',
                    entity: 'Trip',
                    entityId: trip.id,
                    payload: { tripNumber, estimatedQuantityTons, driverId, truckId },
                },
            });
            return trip;
        });
    }
    async updateTripStatus(id, body, req) {
        const { status, actualLoadedTons, actualDeliveredTons } = body;
        const trip = await this.prisma.trip.findUnique({
            where: { id },
            include: { driver: true, truck: true },
        });
        if (!trip) {
            throw new common_1.BadRequestException('Trip not found');
        }
        const updatedData = { status };
        if (status === client_1.TripStatus.DISPATCHED) {
            updatedData.actualStartDate = new Date();
        }
        if (status === client_1.TripStatus.COMPLETED) {
            updatedData.actualEndDate = new Date();
        }
        if (actualLoadedTons !== undefined)
            updatedData.actualLoadedTons = Number(actualLoadedTons);
        if (actualDeliveredTons !== undefined)
            updatedData.actualDeliveredTons = Number(actualDeliveredTons);
        return this.prisma.$transaction(async (tx) => {
            const updatedTrip = await tx.trip.update({
                where: { id },
                data: updatedData,
            });
            if (status === client_1.TripStatus.COMPLETED || status === client_1.TripStatus.CANCELLED) {
                await tx.driver.update({
                    where: { id: trip.driverId },
                    data: { status: 'AVAILABLE' },
                });
                await tx.truck.update({
                    where: { id: trip.truckId },
                    data: { status: 'AVAILABLE' },
                });
            }
            await tx.auditLog.create({
                data: {
                    userId: req.user.id,
                    action: 'TRIP_STATUS_UPDATED',
                    entity: 'Trip',
                    entityId: id,
                    payload: { oldStatus: trip.status, newStatus: status, weightLoaded: actualLoadedTons },
                },
            });
            return updatedTrip;
        });
    }
    async generateGatepass(id, body, req) {
        const { type, tareWeightTons, grossWeightTons, sealNumber, remarks } = body;
        const trip = await this.prisma.trip.findUnique({ where: { id } });
        if (!trip) {
            throw new common_1.BadRequestException('Trip not found');
        }
        const gatepassCount = await this.prisma.gatepass.count();
        const gatepassNumber = `GP-${type === client_1.GatepassType.INBOUND ? 'IN' : 'OUT'}-${10000 + gatepassCount + 1}`;
        const tareVal = tareWeightTons ? Number(tareWeightTons) : 0;
        const grossVal = grossWeightTons ? Number(grossWeightTons) : 0;
        const netWeightTons = grossVal > tareVal ? grossVal - tareVal : 0;
        const gatepass = await this.prisma.gatepass.create({
            data: {
                gatepassNumber,
                tripId: id,
                type,
                tareWeightTons: tareWeightTons ? Number(tareWeightTons) : null,
                grossWeightTons: grossWeightTons ? Number(grossWeightTons) : null,
                netWeightTons: netWeightTons > 0 ? netWeightTons : null,
                sealNumber,
                remarks,
                qrCodeUrl: `https://tms-api.enterprise.com/gatepasses/qr/${gatepassNumber}`,
                expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
            },
        });
        await this.prisma.auditLog.create({
            data: {
                userId: req.user.id,
                action: 'GATEPASS_ISSUED',
                entity: 'Gatepass',
                entityId: gatepass.id,
                payload: { gatepassNumber, type, netWeightTons },
            },
        });
        return gatepass;
    }
};
exports.TripController = TripController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], TripController.prototype, "getTrips", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], TripController.prototype, "getTripById", null);
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Roles)(client_1.UserRole.SYS_ADMIN, client_1.UserRole.LOGISTICS_MANAGER, client_1.UserRole.DISPATCHER),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], TripController.prototype, "createTrip", null);
__decorate([
    (0, common_1.Put)(':id/status'),
    (0, roles_decorator_1.Roles)(client_1.UserRole.SYS_ADMIN, client_1.UserRole.LOGISTICS_MANAGER, client_1.UserRole.DISPATCHER, client_1.UserRole.GATE_OPERATOR),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], TripController.prototype, "updateTripStatus", null);
__decorate([
    (0, common_1.Post)(':id/gatepass'),
    (0, roles_decorator_1.Roles)(client_1.UserRole.SYS_ADMIN, client_1.UserRole.DISPATCHER, client_1.UserRole.GATE_OPERATOR),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], TripController.prototype, "generateGatepass", null);
exports.TripController = TripController = __decorate([
    (0, common_1.Controller)('trips'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], TripController);
//# sourceMappingURL=trip.controller.js.map