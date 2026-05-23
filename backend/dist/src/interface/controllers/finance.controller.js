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
exports.FinanceController = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../infrastructure/database/prisma.service");
const jwt_auth_guard_1 = require("../../infrastructure/security/jwt-auth.guard");
const roles_guard_1 = require("../../infrastructure/security/roles.guard");
const roles_decorator_1 = require("../../infrastructure/security/roles.decorator");
const client_1 = require("@prisma/client");
let FinanceController = class FinanceController {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getFinanceAnalytics() {
        const invoices = await this.prisma.invoice.findMany();
        const expenses = await this.prisma.expense.findMany();
        const totalInvoiced = invoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0);
        const totalExpenses = expenses.reduce((sum, exp) => sum + Number(exp.amount), 0);
        const pendingInvoices = invoices.filter(i => i.status === client_1.InvoiceStatus.PENDING_RECONCILIATION).length;
        const disputedInvoices = invoices.filter(i => i.status === client_1.InvoiceStatus.DISPUTED).length;
        const expenseBreakdown = {
            FUEL: expenses.filter(e => e.category === 'FUEL').reduce((sum, e) => sum + Number(e.amount), 0),
            TOLL: expenses.filter(e => e.category === 'TOLL').reduce((sum, e) => sum + Number(e.amount), 0),
            DRIVER_ALLOWANCE: expenses.filter(e => e.category === 'DRIVER_ALLOWANCE').reduce((sum, e) => sum + Number(e.amount), 0),
            MAINTENANCE: expenses.filter(e => e.category === 'MAINTENANCE').reduce((sum, e) => sum + Number(e.amount), 0),
            OTHER: expenses.filter(e => e.category === 'OTHER' || e.category === 'REPAIR' || e.category === 'FINES').reduce((sum, e) => sum + Number(e.amount), 0),
        };
        return {
            revenueKPI: totalInvoiced,
            expenseKPI: totalExpenses,
            netMarginKPI: totalInvoiced - totalExpenses,
            reconciliationQueueCount: pendingInvoices,
            disputedQueueCount: disputedInvoices,
            expenseBreakdown,
        };
    }
    async getAllInvoices() {
        return this.prisma.invoice.findMany({
            include: {
                trip: {
                    select: {
                        tripNumber: true,
                        source: true,
                        destination: true,
                        purchaseOrder: { select: { poNumber: true, clientName: true } },
                    },
                },
                vendor: { select: { name: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    async getPurchaseOrders() {
        return this.prisma.purchaseOrder.findMany({
            include: {
                _count: { select: { trips: true } }
            }
        });
    }
    async getExpenses() {
        return this.prisma.expense.findMany({
            include: {
                trip: { select: { tripNumber: true } },
                approvedBy: { select: { fullName: true } }
            }
        });
    }
    async triggerThreeWayMatch(id, req) {
        const invoice = await this.prisma.invoice.findUnique({
            where: { id },
            include: {
                trip: {
                    include: {
                        purchaseOrder: true,
                        gatepasses: true,
                    },
                },
            },
        });
        if (!invoice) {
            throw new common_1.BadRequestException('Invoice record not found');
        }
        const { trip } = invoice;
        const po = trip.purchaseOrder;
        const gatepasses = trip.gatepasses;
        const outboundGP = gatepasses.find(g => g.type === 'OUTBOUND' && g.status === 'USED');
        const inboundGP = gatepasses.find(g => g.type === 'INBOUND' && g.status === 'USED');
        const outboundWeight = outboundGP ? Number(outboundGP.netWeightTons) : 0;
        const inboundWeight = inboundGP ? Number(inboundGP.netWeightTons) : 0;
        if (!outboundWeight || !inboundWeight) {
            const errorMsg = 'Reconciliation Failed: Weighbridge weight records are missing for either entry gatepass or exit unloading gatepass.';
            await this.prisma.invoice.update({
                where: { id },
                data: {
                    status: client_1.InvoiceStatus.DISPUTED,
                    reconciliationLog: errorMsg,
                },
            });
            return { success: false, matchStatus: 'DISPUTED', error: errorMsg };
        }
        const weightVariance = Math.abs(outboundWeight - inboundWeight);
        const variancePercentage = (weightVariance / outboundWeight) * 100;
        const varianceLimitPercent = 0.50;
        const weightsMatched = variancePercentage <= varianceLimitPercent;
        const expectedRate = Number(po.ratePerTon);
        const invoiceRate = Number(invoice.subtotal) / inboundWeight;
        const rateDiff = Math.abs(expectedRate - invoiceRate);
        const rateMatched = rateDiff < 0.05;
        const meetsAllMatchingThresholds = weightsMatched && rateMatched;
        const finalStatus = meetsAllMatchingThresholds ? client_1.InvoiceStatus.SENT : client_1.InvoiceStatus.DISPUTED;
        const auditSummary = {
            purchaseOrder: po.poNumber,
            clientContractRate: expectedRate,
            billingInvoiceRate: Number(invoiceRate.toFixed(2)),
            rateMatched,
            loadingGrossWeight: outboundWeight,
            unloadedNetWeight: inboundWeight,
            shrinkageTons: Number(weightVariance.toFixed(2)),
            shrinkagePercentage: Number(variancePercentage.toFixed(2)),
            shrinkageAllowedPercentage: varianceLimitPercent,
            weightsMatched,
            automatedPass: meetsAllMatchingThresholds,
            executedAt: new Date(),
        };
        const updatedInvoice = await this.prisma.invoice.update({
            where: { id },
            data: {
                status: finalStatus,
                validatedAt: new Date(),
                reconciliationLog: JSON.stringify(auditSummary, null, 2),
            },
        });
        await this.prisma.auditLog.create({
            data: {
                userId: req.user.id,
                action: 'INVOICE_THREE_WAY_MATCH_RUN',
                entity: 'Invoice',
                entityId: id,
                payload: auditSummary,
            },
        });
        return {
            success: meetsAllMatchingThresholds,
            matchStatus: finalStatus,
            reconciliationDetails: auditSummary,
            invoice: updatedInvoice,
        };
    }
    async updateInvoiceStatus(id, body, req) {
        const { status } = body;
        const invoice = await this.prisma.invoice.findUnique({ where: { id } });
        if (!invoice) {
            throw new common_1.BadRequestException('Invoice not found');
        }
        const updated = await this.prisma.invoice.update({
            where: { id },
            data: { status, reconciledAt: status === client_1.InvoiceStatus.PAID ? new Date() : null },
        });
        await this.prisma.auditLog.create({
            data: {
                userId: req.user.id,
                action: 'INVOICE_STATUS_UPDATED',
                entity: 'Invoice',
                entityId: id,
                payload: { oldStatus: invoice.status, newStatus: status },
            },
        });
        return updated;
    }
};
exports.FinanceController = FinanceController;
__decorate([
    (0, common_1.Get)('analytics'),
    (0, roles_decorator_1.Roles)(client_1.UserRole.SYS_ADMIN, client_1.UserRole.FINANCE_OFFICER, client_1.UserRole.LOGISTICS_MANAGER),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "getFinanceAnalytics", null);
__decorate([
    (0, common_1.Get)('invoices'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "getAllInvoices", null);
__decorate([
    (0, common_1.Get)('purchase-orders'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "getPurchaseOrders", null);
__decorate([
    (0, common_1.Get)('expenses'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "getExpenses", null);
__decorate([
    (0, common_1.Post)('invoices/:id/three-way-match'),
    (0, roles_decorator_1.Roles)(client_1.UserRole.SYS_ADMIN, client_1.UserRole.FINANCE_OFFICER),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "triggerThreeWayMatch", null);
__decorate([
    (0, common_1.Put)('invoices/:id/status'),
    (0, roles_decorator_1.Roles)(client_1.UserRole.SYS_ADMIN, client_1.UserRole.FINANCE_OFFICER),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "updateInvoiceStatus", null);
exports.FinanceController = FinanceController = __decorate([
    (0, common_1.Controller)('finance'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], FinanceController);
//# sourceMappingURL=finance.controller.js.map