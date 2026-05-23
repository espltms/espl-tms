import { Controller, Get, Post, Put, Body, Param, Query, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { JwtAuthGuard } from '../../infrastructure/security/jwt-auth.guard';
import { RolesGuard } from '../../infrastructure/security/roles.guard';
import { Roles } from '../../infrastructure/security/roles.decorator';
import { UserRole, TripStatus, GatepassType, GatepassStatus } from '@prisma/client';

@Controller('trips')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TripController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async getTrips(@Query('status') status?: TripStatus) {
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

  @Get(':id')
  async getTripById(@Param('id') id: string) {
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
      throw new BadRequestException('Trip not found');
    }

    return trip;
  }

  @Post()
  @Roles(UserRole.SYS_ADMIN, UserRole.LOGISTICS_MANAGER, UserRole.DISPATCHER)
  async createTrip(@Body() body: any, @Request() req: any) {
    const {
      purchaseOrderId,
      driverId,
      truckId,
      vendorId,
      source,
      destination,
      distanceKm,
      estimatedQuantityTons,
      scheduledStartDate,
    } = body;

    if (!purchaseOrderId || !driverId || !truckId || !source || !destination || !estimatedQuantityTons) {
      throw new BadRequestException('Missing required trip assignment parameters');
    }

    // Enterprise Transactional Safeguard: Check PO capacity allocation limits
    return this.prisma.$transaction(async (tx) => {
      // 1. Fetch Purchase Order inside isolation block
      const po = await tx.purchaseOrder.findUnique({
        where: { id: purchaseOrderId },
      });

      if (!po || po.status !== 'ACTIVE') {
        throw new BadRequestException('Selected Purchase Order is invalid or inactive');
      }

      const currentAllocated = Number(po.allocatedQuantityTons);
      const limit = Number(po.totalQuantityTons);
      const newAllocation = currentAllocated + Number(estimatedQuantityTons);

      if (newAllocation > limit) {
        throw new BadRequestException(
          `Insufficient remaining capacity on PO ${po.poNumber}. Available: ${limit - currentAllocated} tons, Requested: ${estimatedQuantityTons} tons`,
        );
      }

      // 2. Double check driver status availability
      const driver = await tx.driver.findUnique({ where: { id: driverId } });
      if (!driver || driver.status !== 'AVAILABLE' || !driver.complianceVerified) {
        throw new BadRequestException('Driver is not available or has non-compliant active records');
      }

      // 3. Double check truck status availability
      const truck = await tx.truck.findUnique({ where: { id: truckId } });
      if (!truck || truck.status !== 'AVAILABLE' || !truck.complianceVerified) {
        throw new BadRequestException('Truck is not available or vehicle registration is expired');
      }

      // 4. Update PO allocation size
      await tx.purchaseOrder.update({
        where: { id: purchaseOrderId },
        data: { allocatedQuantityTons: newAllocation },
      });

      // 5. Update Driver & Truck statuses to busy
      await tx.driver.update({
        where: { id: driverId },
        data: { status: 'ON_TRIP' },
      });

      await tx.truck.update({
        where: { id: truckId },
        data: { status: 'ON_TRIP' },
      });

      // 6. Generate sequential Trip Number
      const tripCount = await tx.trip.count();
      const tripNumber = `TRIP-${10000 + tripCount + 1}`;

      // 7. Create Trip entity
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
          status: TripStatus.SCHEDULED,
        },
      });

      // 8. Generate Audit Log
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

  @Put(':id/status')
  @Roles(UserRole.SYS_ADMIN, UserRole.LOGISTICS_MANAGER, UserRole.DISPATCHER, UserRole.GATE_OPERATOR)
  async updateTripStatus(
    @Param('id') id: string,
    @Body() body: { status: TripStatus; actualLoadedTons?: number; actualDeliveredTons?: number },
    @Request() req: any,
  ) {
    const { status, actualLoadedTons, actualDeliveredTons } = body;
    const trip = await this.prisma.trip.findUnique({
      where: { id },
      include: { driver: true, truck: true },
    });

    if (!trip) {
      throw new BadRequestException('Trip not found');
    }

    const updatedData: any = { status };

    if (status === TripStatus.DISPATCHED) {
      updatedData.actualStartDate = new Date();
    }

    if (status === TripStatus.COMPLETED) {
      updatedData.actualEndDate = new Date();
    }

    if (actualLoadedTons !== undefined) updatedData.actualLoadedTons = Number(actualLoadedTons);
    if (actualDeliveredTons !== undefined) updatedData.actualDeliveredTons = Number(actualDeliveredTons);

    return this.prisma.$transaction(async (tx) => {
      const updatedTrip = await tx.trip.update({
        where: { id },
        data: updatedData,
      });

      // Release driver and vehicle back to AVAILABLE pool once trip concludes
      if (status === TripStatus.COMPLETED || status === TripStatus.CANCELLED) {
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

  @Post(':id/gatepass')
  @Roles(UserRole.SYS_ADMIN, UserRole.DISPATCHER, UserRole.GATE_OPERATOR)
  async generateGatepass(
    @Param('id') id: string,
    @Body() body: { type: GatepassType; tareWeightTons?: number; grossWeightTons?: number; sealNumber?: string; remarks?: string },
    @Request() req: any,
  ) {
    const { type, tareWeightTons, grossWeightTons, sealNumber, remarks } = body;
    const trip = await this.prisma.trip.findUnique({ where: { id } });

    if (!trip) {
      throw new BadRequestException('Trip not found');
    }

    const gatepassCount = await this.prisma.gatepass.count();
    const gatepassNumber = `GP-${type === GatepassType.INBOUND ? 'IN' : 'OUT'}-${10000 + gatepassCount + 1}`;
    
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
        expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000), // 12 hours valid window
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
}
