import { Controller, Get, Post, Put, Body, Param, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { JwtAuthGuard } from '../../../infrastructure/security/jwt-auth.guard';
import { RolesGuard } from '../../../infrastructure/security/roles.guard';
import { Roles } from '../../../infrastructure/security/roles.decorator';
import { UserRole, InvoiceStatus, InvoiceType } from '@prisma/client';

@Controller('finance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FinanceController {
  constructor(private prisma: PrismaService) {}

  @Get('analytics')
  @Roles(UserRole.SYS_ADMIN, UserRole.FINANCE_OFFICER, UserRole.LOGISTICS_MANAGER)
  async getFinanceAnalytics() {
    const invoices = await this.prisma.invoice.findMany();
    const expenses = await this.prisma.expense.findMany();

    const totalInvoiced = invoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0);
    const totalExpenses = expenses.reduce((sum, exp) => sum + Number(exp.amount), 0);
    const pendingInvoices = invoices.filter(i => i.status === InvoiceStatus.PENDING_RECONCILIATION).length;
    const disputedInvoices = invoices.filter(i => i.status === InvoiceStatus.DISPUTED).length;

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

  @Get('invoices')
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

  @Get('purchase-orders')
  async getPurchaseOrders() {
    return this.prisma.purchaseOrder.findMany({
      include: {
        _count: { select: { trips: true } }
      }
    });
  }

  @Get('expenses')
  async getExpenses() {
    return this.prisma.expense.findMany({
      include: {
        trip: { select: { tripNumber: true } },
        approvedBy: { select: { fullName: true } }
      }
    });
  }

  @Post('invoices/:id/three-way-match')
  @Roles(UserRole.SYS_ADMIN, UserRole.FINANCE_OFFICER)
  async triggerThreeWayMatch(@Param('id') id: string, @Request() req: any) {
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
      throw new BadRequestException('Invoice record not found');
    }

    const { trip } = invoice;
    const po = trip.purchaseOrder;
    const gatepasses = trip.gatepasses;

    // 1. Gather Outbound Loading and Inbound Unloading Weights
    const outboundGP = gatepasses.find(g => g.type === 'OUTBOUND' && g.status === 'USED');
    const inboundGP = gatepasses.find(g => g.type === 'INBOUND' && g.status === 'USED');

    const outboundWeight = outboundGP ? Number(outboundGP.netWeightTons) : 0;
    const inboundWeight = inboundGP ? Number(inboundGP.netWeightTons) : 0;
    
    // Check if both weighments exist
    if (!outboundWeight || !inboundWeight) {
      const errorMsg = 'Reconciliation Failed: Weighbridge weight records are missing for either entry gatepass or exit unloading gatepass.';
      await this.prisma.invoice.update({
        where: { id },
        data: {
          status: InvoiceStatus.DISPUTED,
          reconciliationLog: errorMsg,
        },
      });
      return { success: false, matchStatus: 'DISPUTED', error: errorMsg };
    }

    // 2. Perform math checking
    // Tolerance checking: bulk commodity transit shrinkage / moisture loss should be <= 0.50%
    const weightVariance = Math.abs(outboundWeight - inboundWeight);
    const variancePercentage = (weightVariance / outboundWeight) * 100;
    const varianceLimitPercent = 0.50; // Enterprise Standard
    const weightsMatched = variancePercentage <= varianceLimitPercent;

    // Rate validation checking: aggregate pricing contract verification
    const expectedRate = Number(po.ratePerTon);
    const invoiceRate = Number(invoice.subtotal) / inboundWeight;
    const rateDiff = Math.abs(expectedRate - invoiceRate);
    const rateMatched = rateDiff < 0.05; // Less than 5 cents margin

    // Summary matches
    const meetsAllMatchingThresholds = weightsMatched && rateMatched;
    const finalStatus = meetsAllMatchingThresholds ? InvoiceStatus.SENT : InvoiceStatus.DISPUTED;

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

  @Put('invoices/:id/status')
  @Roles(UserRole.SYS_ADMIN, UserRole.FINANCE_OFFICER)
  async updateInvoiceStatus(
    @Param('id') id: string,
    @Body() body: { status: InvoiceStatus },
    @Request() req: any,
  ) {
    const { status } = body;
    const invoice = await this.prisma.invoice.findUnique({ where: { id } });
    if (!invoice) {
      throw new BadRequestException('Invoice not found');
    }

    const updated = await this.prisma.invoice.update({
      where: { id },
      data: { status, reconciledAt: status === InvoiceStatus.PAID ? new Date() : null },
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
}
