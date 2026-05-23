import { Controller, Get, Post, Put, Body, Param, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { JwtAuthGuard } from '../../../infrastructure/security/jwt-auth.guard';
import { RolesGuard } from '../../../infrastructure/security/roles.guard';
import { Roles } from '../../../infrastructure/security/roles.decorator';
import { UserRole, ComplianceStatus } from '@prisma/client';

@Controller('compliance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ComplianceController {
  constructor(private prisma: PrismaService) {}

  @Get('summary')
  @Roles(UserRole.SYS_ADMIN, UserRole.LOGISTICS_MANAGER, UserRole.COMPLIANCE_OFFICER)
  async getComplianceSummary() {
    const totalDrivers = await this.prisma.driver.count();
    const compliantDrivers = await this.prisma.driver.count({ where: { complianceVerified: true } });
    const nonCompliantDrivers = totalDrivers - compliantDrivers;

    const totalTrucks = await this.prisma.truck.count();
    const compliantTrucks = await this.prisma.truck.count({ where: { complianceVerified: true } });
    const nonCompliantTrucks = totalTrucks - compliantTrucks;

    const pendingReviews = await this.prisma.complianceRecord.count({
      where: { status: ComplianceStatus.PENDING },
    });

    const expiringSoon = await this.prisma.complianceRecord.count({
      where: {
        expiryDate: {
          gte: new Date(),
          lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Next 30 days
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

  @Get('records')
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

  @Put('records/:id/verify')
  @Roles(UserRole.SYS_ADMIN, UserRole.COMPLIANCE_OFFICER)
  async verifyRecord(
    @Param('id') id: string,
    @Body() body: { status: ComplianceStatus; rejectionReason?: string },
    @Request() req: any,
  ) {
    const { status, rejectionReason } = body;
    if (status === ComplianceStatus.PENDING) {
      throw new BadRequestException('Must resolve pending record to Approved or Rejected status');
    }

    const record = await this.prisma.complianceRecord.findUnique({
      where: { id },
    });

    if (!record) {
      throw new BadRequestException('Compliance record not found');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Update the record status
      const updatedRecord = await tx.complianceRecord.update({
        where: { id },
        data: {
          status,
          rejectionReason: status === ComplianceStatus.REJECTED ? rejectionReason : null,
          verifiedById: req.user.id,
        },
      });

      // 2. Proactively re-evaluate the parent Driver/Truck verification compliance states
      if (record.driverId) {
        const allDriverRecords = await tx.complianceRecord.findMany({
          where: { driverId: record.driverId },
        });
        
        // A driver is compliant if they have no rejected or expired records, and at least one approved license
        const hasLicense = allDriverRecords.some(r => r.documentType === 'DRIVING_LICENSE' && r.status === ComplianceStatus.APPROVED);
        const hasRejections = allDriverRecords.some(r => r.status === ComplianceStatus.REJECTED);
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

        const hasRegistration = allTruckRecords.some(r => r.documentType === 'VEHICLE_REGISTRATION' && r.status === ComplianceStatus.APPROVED);
        const hasRejections = allTruckRecords.some(r => r.status === ComplianceStatus.REJECTED);
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
}
