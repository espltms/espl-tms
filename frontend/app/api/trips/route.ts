import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';
import { getPagination, getSearchParam } from '@/lib/apiQuery';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (user?.role === 'REGION_ADMIN') {
      const { page, limit } = getPagination(req);
      return NextResponse.json({ data: [], total: 0, page, limit });
    }

    const { page, limit, skip } = getPagination(req);
    const status = getSearchParam(req, 'status');
    const search = getSearchParam(req, 'search');

    const where: any = {};
    if (status) where.status = status;
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

    return NextResponse.json({ data: trips, total, page, limit });
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
    const trip = await prisma.trip.create({
      data: {
        tripNumber: body.tripNumber,
        purchaseOrderId: body.purchaseOrderId,
        driverId: body.driverId,
        truckId: body.truckId,
        source: body.source,
        destination: body.destination,
        distanceKm: body.distanceKm || 0,
        estimatedQuantityTons: body.estimatedQuantityTons || 0,
        status: body.status || 'SCHEDULED',
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
