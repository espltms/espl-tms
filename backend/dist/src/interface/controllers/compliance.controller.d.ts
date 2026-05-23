import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ComplianceStatus } from '@prisma/client';
export declare class ComplianceController {
    private prisma;
    constructor(prisma: PrismaService);
    getComplianceSummary(): Promise<{
        drivers: {
            total: number;
            compliant: number;
            nonCompliant: number;
        };
        trucks: {
            total: number;
            compliant: number;
            nonCompliant: number;
        };
        pendingReviews: number;
        expiringSoon: number;
    }>;
    getAllRecords(): Promise<({
        driver: {
            fullName: string;
            licenseNumber: string;
        };
        truck: {
            plateNumber: string;
            model: string;
        };
        verifiedBy: {
            fullName: string;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import(".prisma/client").$Enums.ComplianceStatus;
        documentType: import(".prisma/client").$Enums.DocumentType;
        documentNumber: string | null;
        documentUrl: string;
        expiryDate: Date;
        rejectionReason: string | null;
        verifiedById: string | null;
        driverId: string | null;
        truckId: string | null;
    })[]>;
    verifyRecord(id: string, body: {
        status: ComplianceStatus;
        rejectionReason?: string;
    }, req: any): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import(".prisma/client").$Enums.ComplianceStatus;
        documentType: import(".prisma/client").$Enums.DocumentType;
        documentNumber: string | null;
        documentUrl: string;
        expiryDate: Date;
        rejectionReason: string | null;
        verifiedById: string | null;
        driverId: string | null;
        truckId: string | null;
    }>;
}
