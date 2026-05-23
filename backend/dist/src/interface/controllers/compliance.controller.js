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
exports.ComplianceController = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../infrastructure/database/prisma.service");
const jwt_auth_guard_1 = require("../../infrastructure/security/jwt-auth.guard");
const roles_guard_1 = require("../../infrastructure/security/roles.guard");
const roles_decorator_1 = require("../../infrastructure/security/roles.decorator");
const client_1 = require("@prisma/client");
let ComplianceController = class ComplianceController {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getComplianceSummary() {
        const totalDrivers = await this.prisma.driver.count();
        const compliantDrivers = await this.prisma.driver.count({ where: { complianceVerified: true } });
        const nonCompliantDrivers = totalDrivers - compliantDrivers;
        const totalTrucks = await this.prisma.truck.count();
        const compliantTrucks = await this.prisma.truck.count({ where: { complianceVerified: true } });
        const nonCompliantTrucks = totalTrucks - compliantTrucks;
        const pendingReviews = await this.prisma.complianceRecord.count({
            where: { status: client_1.ComplianceStatus.PENDING },
        });
        const expiringSoon = await this.prisma.complianceRecord.count({
            where: {
                expiryDate: {
                    gte: new Date(),
                    lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                },
            },
        });
        return {
            drivers: { total: totalDrivers, compliant: compliantDrivers, nonCompliant: nonCompliantDrivers },
            trucks: { total: totalTrucks, compliant: compliantTrucks, nonCompliant: nonCompliantTrucks },
            pendingReviews,
            expiringSoon,
        };
    }
    async getAllRecords() {
        return this.prisma.complianceRecord.findMany({
            include: {
                driver: { select: { fullName: true, licenseNumber: true } },
                truck: { select: { plateNumber: true, model: true } },
                verifiedBy: { select: { fullName: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    async verifyRecord(id, body, req) {
        const { status, rejectionReason } = body;
        if (status === client_1.ComplianceStatus.PENDING) {
            throw new common_1.BadRequestException('Must resolve pending record to Approved or Rejected status');
        }
        const record = await this.prisma.complianceRecord.findUnique({
            where: { id },
        });
        if (!record) {
            throw new common_1.BadRequestException('Compliance record not found');
        }
        return this.prisma.$transaction(async (tx) => {
            const updatedRecord = await tx.complianceRecord.update({
                where: { id },
                data: {
                    status,
                    rejectionReason: status === client_1.ComplianceStatus.REJECTED ? rejectionReason : null,
                    verifiedById: req.user.id,
                },
            });
            if (record.driverId) {
                const allDriverRecords = await tx.complianceRecord.findMany({
                    where: { driverId: record.driverId },
                });
                const hasLicense = allDriverRecords.some(r => r.documentType === 'DRIVING_LICENSE' && r.status === client_1.ComplianceStatus.APPROVED);
                const hasRejections = allDriverRecords.some(r => r.status === client_1.ComplianceStatus.REJECTED);
                const isCompliant = hasLicense && !hasRejections;
                await tx.driver.update({
                    where: { id: record.driverId },
                    data: { complianceVerified: isCompliant },
                });
            }
            if (record.truckId) {
                const allTruckRecords = await tx.complianceRecord.findMany({
                    where: { truckId: record.truckId },
                });
                const hasRegistration = allTruckRecords.some(r => r.documentType === 'VEHICLE_REGISTRATION' && r.status === client_1.ComplianceStatus.APPROVED);
                const hasRejections = allTruckRecords.some(r => r.status === client_1.ComplianceStatus.REJECTED);
                const isCompliant = hasRegistration && !hasRejections;
                await tx.truck.update({
                    where: { id: record.truckId },
                    data: { complianceVerified: isCompliant },
                });
            }
            await tx.auditLog.create({
                data: {
                    userId: req.user.id,
                    action: 'COMPLIANCE_VERIFIED',
                    entity: 'ComplianceRecord',
                    entityId: id,
                    payload: { documentType: record.documentType, result: status },
                },
            });
            return updatedRecord;
        });
    }
};
exports.ComplianceController = ComplianceController;
__decorate([
    (0, common_1.Get)('summary'),
    (0, roles_decorator_1.Roles)(client_1.UserRole.SYS_ADMIN, client_1.UserRole.LOGISTICS_MANAGER, client_1.UserRole.COMPLIANCE_OFFICER),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ComplianceController.prototype, "getComplianceSummary", null);
__decorate([
    (0, common_1.Get)('records'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ComplianceController.prototype, "getAllRecords", null);
__decorate([
    (0, common_1.Put)('records/:id/verify'),
    (0, roles_decorator_1.Roles)(client_1.UserRole.SYS_ADMIN, client_1.UserRole.COMPLIANCE_OFFICER),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], ComplianceController.prototype, "verifyRecord", null);
exports.ComplianceController = ComplianceController = __decorate([
    (0, common_1.Controller)('compliance'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ComplianceController);
//# sourceMappingURL=compliance.controller.js.map