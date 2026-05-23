import { PrismaService } from '../../infrastructure/database/prisma.service';
import { TripStatus, GatepassType } from '@prisma/client';
export declare class TripController {
    private prisma;
    constructor(prisma: PrismaService);
    getTrips(status?: TripStatus): Promise<({
        driver: {
            fullName: string;
            phone: string;
        };
        truck: {
            plateNumber: string;
            model: string;
        };
        vendor: {
            name: string;
        };
        purchaseOrder: {
            poNumber: string;
            clientName: string;
            commodity: string;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import(".prisma/client").$Enums.TripStatus;
        driverId: string;
        truckId: string;
        tripNumber: string;
        source: string;
        destination: string;
        distanceKm: import("@prisma/client/runtime/library").Decimal;
        estimatedQuantityTons: import("@prisma/client/runtime/library").Decimal;
        actualLoadedTons: import("@prisma/client/runtime/library").Decimal | null;
        actualDeliveredTons: import("@prisma/client/runtime/library").Decimal | null;
        scheduledStartDate: Date;
        actualStartDate: Date | null;
        actualEndDate: Date | null;
        purchaseOrderId: string;
        vendorId: string | null;
    })[]>;
    getTripById(id: string): Promise<{
        driver: {
            id: string;
            fullName: string;
            phone: string;
            createdAt: Date;
            updatedAt: Date;
            licenseNumber: string;
            licenseExpiry: Date;
            status: import(".prisma/client").$Enums.DriverStatus;
            complianceVerified: boolean;
        };
        truck: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            status: import(".prisma/client").$Enums.TruckStatus;
            complianceVerified: boolean;
            plateNumber: string;
            model: string;
            capacityTons: import("@prisma/client/runtime/library").Decimal;
            type: string;
            gpsDeviceId: string | null;
        };
        invoices: {
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
        }[];
        vendor: {
            id: string;
            email: string;
            phone: string;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            complianceVerified: boolean;
            taxId: string;
            address: string;
            paymentTermsDays: number;
        };
        purchaseOrder: {
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
        };
        gatepasses: {
            id: string;
            status: import(".prisma/client").$Enums.GatepassStatus;
            type: import(".prisma/client").$Enums.GatepassType;
            gatepassNumber: string;
            tareWeightTons: import("@prisma/client/runtime/library").Decimal | null;
            grossWeightTons: import("@prisma/client/runtime/library").Decimal | null;
            netWeightTons: import("@prisma/client/runtime/library").Decimal | null;
            sealNumber: string | null;
            remarks: string | null;
            qrCodeUrl: string | null;
            issuedAt: Date;
            expiresAt: Date;
            scannedAt: Date | null;
            tripId: string;
        }[];
        gpsPings: {
            id: string;
            tripId: string;
            latitude: import("@prisma/client/runtime/library").Decimal;
            longitude: import("@prisma/client/runtime/library").Decimal;
            speedKmh: import("@prisma/client/runtime/library").Decimal;
            heading: number;
            timestamp: Date;
        }[];
        expenses: ({
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
        })[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import(".prisma/client").$Enums.TripStatus;
        driverId: string;
        truckId: string;
        tripNumber: string;
        source: string;
        destination: string;
        distanceKm: import("@prisma/client/runtime/library").Decimal;
        estimatedQuantityTons: import("@prisma/client/runtime/library").Decimal;
        actualLoadedTons: import("@prisma/client/runtime/library").Decimal | null;
        actualDeliveredTons: import("@prisma/client/runtime/library").Decimal | null;
        scheduledStartDate: Date;
        actualStartDate: Date | null;
        actualEndDate: Date | null;
        purchaseOrderId: string;
        vendorId: string | null;
    }>;
    createTrip(body: any, req: any): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import(".prisma/client").$Enums.TripStatus;
        driverId: string;
        truckId: string;
        tripNumber: string;
        source: string;
        destination: string;
        distanceKm: import("@prisma/client/runtime/library").Decimal;
        estimatedQuantityTons: import("@prisma/client/runtime/library").Decimal;
        actualLoadedTons: import("@prisma/client/runtime/library").Decimal | null;
        actualDeliveredTons: import("@prisma/client/runtime/library").Decimal | null;
        scheduledStartDate: Date;
        actualStartDate: Date | null;
        actualEndDate: Date | null;
        purchaseOrderId: string;
        vendorId: string | null;
    }>;
    updateTripStatus(id: string, body: {
        status: TripStatus;
        actualLoadedTons?: number;
        actualDeliveredTons?: number;
    }, req: any): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import(".prisma/client").$Enums.TripStatus;
        driverId: string;
        truckId: string;
        tripNumber: string;
        source: string;
        destination: string;
        distanceKm: import("@prisma/client/runtime/library").Decimal;
        estimatedQuantityTons: import("@prisma/client/runtime/library").Decimal;
        actualLoadedTons: import("@prisma/client/runtime/library").Decimal | null;
        actualDeliveredTons: import("@prisma/client/runtime/library").Decimal | null;
        scheduledStartDate: Date;
        actualStartDate: Date | null;
        actualEndDate: Date | null;
        purchaseOrderId: string;
        vendorId: string | null;
    }>;
    generateGatepass(id: string, body: {
        type: GatepassType;
        tareWeightTons?: number;
        grossWeightTons?: number;
        sealNumber?: string;
        remarks?: string;
    }, req: any): Promise<{
        id: string;
        status: import(".prisma/client").$Enums.GatepassStatus;
        type: import(".prisma/client").$Enums.GatepassType;
        gatepassNumber: string;
        tareWeightTons: import("@prisma/client/runtime/library").Decimal | null;
        grossWeightTons: import("@prisma/client/runtime/library").Decimal | null;
        netWeightTons: import("@prisma/client/runtime/library").Decimal | null;
        sealNumber: string | null;
        remarks: string | null;
        qrCodeUrl: string | null;
        issuedAt: Date;
        expiresAt: Date;
        scannedAt: Date | null;
        tripId: string;
    }>;
}
