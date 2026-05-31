import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';
import { getPagination, getSearchParam } from '@/lib/apiQuery';
import { normalizeOperationalStatus } from '@/lib/operationalStatus';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    const isRegAdmin = user?.role === 'REGION_ADMIN' || user?.role === 'PARAMANANDPUR_ADMIN' || user?.role === 'DHARAMGARH_ADMIN' || user?.role === 'BHAWANIPATNA_ADMIN';
    if (isRegAdmin) {
      const { page, limit } = getPagination(req);
      return NextResponse.json({ data: [], total: 0, page, limit });
    }

    const { page, limit, skip } = getPagination(req);
    const status = getSearchParam(req, 'status');
    const search = getSearchParam(req, 'search');

    const where: any = {};
    if (user?.role?.startsWith('VENDOR')) {
      where.vendorName = user.vendorName || '';
    }
    if (user?.role === 'LANJIGARH_LOADER') {
      where.source = { contains: 'lanjigarh', mode: 'insensitive' };
    }
    if (status) {
      const normalizedStatus = normalizeOperationalStatus(status);
      where.status = normalizedStatus === 'IN_TRANSIT'
        ? { in: ['IN_TRANSIT', 'EN_ROUTE'] as any }
        : normalizedStatus;
    }
    if (search) {
      where.OR = [
        { tripNumber: { contains: search, mode: 'insensitive' } },
        { source: { contains: search, mode: 'insensitive' } },
        { destination: { contains: search, mode: 'insensitive' } },
        { driver: { fullName: { contains: search, mode: 'insensitive' } } },
        { truck: { plateNumber: { contains: search, mode: 'insensitive' } } },
        { purchaseOrder: { poNumber: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [trips, total] = await Promise.all([
      prisma.trip.findMany({
        where,
        include: {
          driver: { select: { fullName: true, phone: true } },
          truck: { select: { plateNumber: true, model: true } },
          purchaseOrder: { select: { poNumber: true, clientName: true, commodity: true } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.trip.count({ where }),
    ]);

    return NextResponse.json({
      data: trips.map(trip => ({ ...trip, status: normalizeOperationalStatus(trip.status) })),
      total,
      page,
      limit,
    });
  } catch (error) {
    console.error('Get trips error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    if (user?.role === 'LANJIGARH_LOADER') {
      if (!body.source || !body.source.toLowerCase().includes('lanjigarh')) {
        return NextResponse.json({ error: 'Lanjigarh Loader can only create trips with source Lanjigarh' }, { status: 403 });
      }
    }
    const purchaseOrder = await prisma.purchaseOrder.findFirst({
      where: {
        OR: [
          body.purchaseOrderId ? { id: body.purchaseOrderId } : undefined,
          body.poNumber ? { poNumber: body.poNumber } : undefined,
        ].filter(Boolean) as any,
      },
    });
    let driver = await prisma.driver.findFirst({
      where: {
        OR: [
          (body.driverId && !body.driverId.startsWith('temp-')) ? { id: body.driverId } : undefined,
          body.driverPhone ? { phone: body.driverPhone } : undefined,
          body.driverName ? { fullName: body.driverName } : undefined,
        ].filter(Boolean) as any,
      },
    });

    if (!driver) {
      const defaultD = await prisma.driver.findFirst();
      if (defaultD) {
        driver = defaultD;
      } else {
        driver = await prisma.driver.create({
          data: {
            fullName: body.driverName || 'Generic Driver',
            licenseNumber: `DL-${Date.now()}`,
            phone: body.driverPhone || `99999${Math.floor(10000 + Math.random() * 90000)}`,
            status: 'AVAILABLE',
          }
        });
      }
    }

    let truck = await prisma.truck.findFirst({
      where: {
        OR: [
          (body.truckId && !body.truckId.startsWith('temp-')) ? { id: body.truckId } : undefined,
          body.truckPlate ? { plateNumber: body.truckPlate } : undefined,
        ].filter(Boolean) as any,
      },
    });

    if (!truck && body.truckPlate) {
      truck = await prisma.truck.create({
        data: {
          plateNumber: body.truckPlate.toUpperCase().trim(),
          model: 'Generic Model',
          capacityTons: body.estimatedQuantityTons || 40.0,
          type: body.vehicleType || 'Tipper',
          status: 'AVAILABLE',
        }
      });
    }

    if (!purchaseOrder || !driver || !truck) {
      return NextResponse.json({ error: 'Could not match PO, driver, or truck in master database' }, { status: 400 });
    }

    const trip = await prisma.trip.create({
      data: {
        tripNumber: body.tripNumber || `TRIP-${Date.now()}`,
        purchaseOrderId: purchaseOrder.id,
        driverId: driver.id,
        truckId: truck.id,
        source: body.source,
        destination: body.destination,
        distanceKm: body.distanceKm || 0,
        estimatedQuantityTons: body.estimatedQuantityTons || 0,
        vendorName: body.vendorName || null,
        vehicleType: body.vehicleType || null,
        status: normalizeOperationalStatus(body.status) as any,
        scheduledStartDate: new Date(body.scheduledStartDate),
      },
      include: {
        driver: { select: { fullName: true, phone: true } },
        truck: { select: { plateNumber: true, model: true } },
        purchaseOrder: { select: { poNumber: true, clientName: true, commodity: true } },
      },
    });

    return NextResponse.json({ data: trip }, { status: 201 });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'Trip number already exists' }, { status: 409 });
    }
    console.error('Create trip error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
