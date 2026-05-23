import { PrismaService } from '../../infrastructure/database/prisma.service';
import { InvoiceStatus } from '@prisma/client';
export declare class FinanceController {
    private prisma;
    constructor(prisma: PrismaService);
    getFinanceAnalytics(): Promise<{
        revenueKPI: number;
        expenseKPI: number;
        netMarginKPI: number;
        reconciliationQueueCount: number;
        disputedQueueCount: number;
        expenseBreakdown: {
            FUEL: number;
            TOLL: number;
            DRIVER_ALLOWANCE: number;
            MAINTENANCE: number;
            OTHER: number;
        };
    }>;
    getAllInvoices(): Promise<({
        vendor: {
            name: string;
        };
        trip: {
            purchaseOrder: {
                poNumber: string;
                clientName: string;
            };
            tripNumber: string;
            source: string;
            destination: string;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import(".prisma/client").$Enums.InvoiceStatus;
        type: import(".prisma/client").$Enums.InvoiceType;
        vendorId: string | null;
        tripId: string;
        invoiceNumber: string;
        subtotal: import("@prisma/client/runtime/library").Decimal;
        taxAmount: import("@prisma/client/runtime/library").Decimal;
        totalAmount: import("@prisma/client/runtime/library").Decimal;
        dueDate: Date;
        validatedAt: Date | null;
        reconciledAt: Date | null;
        reconciliationLog: string | null;
    })[]>;
    getPurchaseOrders(): Promise<({
        _count: {
            trips: number;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import(".prisma/client").$Enums.POStatus;
        poNumber: string;
        clientName: string;
        commodity: string;
        totalQuantityTons: import("@prisma/client/runtime/library").Decimal;
        allocatedQuantityTons: import("@prisma/client/runtime/library").Decimal;
        ratePerTon: import("@prisma/client/runtime/library").Decimal;
        currency: string;
        contractUrl: string | null;
        startDate: Date;
        endDate: Date;
    })[]>;
    getExpenses(): Promise<({
        trip: {
            tripNumber: string;
        };
        approvedBy: {
            fullName: string;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import(".prisma/client").$Enums.ExpenseStatus;
        currency: string;
        tripId: string;
        category: import(".prisma/client").$Enums.ExpenseCategory;
        amount: import("@prisma/client/runtime/library").Decimal;
        receiptUrl: string | null;
        description: string | null;
        approvedById: string | null;
    })[]>;
    triggerThreeWayMatch(id: string, req: any): Promise<{
        success: boolean;
        matchStatus: string;
        error: string;
        reconciliationDetails?: undefined;
        invoice?: undefined;
    } | {
        success: boolean;
        matchStatus: "SENT" | "DISPUTED";
        reconciliationDetails: {
            purchaseOrder: string;
            clientContractRate: number;
            billingInvoiceRate: number;
            rateMatched: boolean;
            loadingGrossWeight: number;
            unloadedNetWeight: number;
            shrinkageTons: number;
            shrinkagePercentage: number;
            shrinkageAllowedPercentage: number;
            weightsMatched: boolean;
            automatedPass: boolean;
            executedAt: Date;
        };
        invoice: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            status: import(".prisma/client").$Enums.InvoiceStatus;
            type: import(".prisma/client").$Enums.InvoiceType;
            vendorId: string | null;
            tripId: string;
            invoiceNumber: string;
            subtotal: import("@prisma/client/runtime/library").Decimal;
            taxAmount: import("@prisma/client/runtime/library").Decimal;
            totalAmount: import("@prisma/client/runtime/library").Decimal;
            dueDate: Date;
            validatedAt: Date | null;
            reconciledAt: Date | null;
            reconciliationLog: string | null;
        };
        error?: undefined;
    }>;
    updateInvoiceStatus(id: string, body: {
        status: InvoiceStatus;
    }, req: any): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import(".prisma/client").$Enums.InvoiceStatus;
        type: import(".prisma/client").$Enums.InvoiceType;
        vendorId: string | null;
        tripId: string;
        invoiceNumber: string;
        subtotal: import("@prisma/client/runtime/library").Decimal;
        taxAmount: import("@prisma/client/runtime/library").Decimal;
        totalAmount: import("@prisma/client/runtime/library").Decimal;
        dueDate: Date;
        validatedAt: Date | null;
        reconciledAt: Date | null;
        reconciliationLog: string | null;
    }>;
}
