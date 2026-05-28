import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';
import { getPagination, getSearchParam } from '@/lib/apiQuery';
import { normalizeOperationalStatus } from '@/lib/operationalStatus';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { page, limit, skip } = getPagination(req);
    const search = getSearchParam(req, 'search');
    const status = getSearchParam(req, 'status');

    const where: any = {};
    if (search) {
      where.OR = [
        { plateNumber: { contains: search, mode: 'insensitive' } },
        { model: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (status) {
      const normalizedStatus = normalizeOperationalStatus(status);
      where.status = normalizedStatus === 'IN_TRANSIT'
        ? { in: ['IN_TRANSIT', 'ON_TRIP'] as any }
        : normalizedStatus;
    }

    const [trucks, total] = await Promise.all([
      prisma.truck.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.truck.count({ where }),
    ]);

    return NextResponse.json({
      data: trucks.map(truck => ({ ...truck, status: normalizeOperationalStatus(truck.status) })),
      total,
      page,
      limit,
    });
  } catch (error) {
    console.error('Get trucks error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const truck = await prisma.truck.create({
      data: {
        plateNumber: body.plateNumber,
        model: body.model,
        capacityTons: body.capacityTons || 0,
        type: body.type || 'Tipper',
        fleetCategory: body.fleetCategory || 'OWNED_FLEET',
        fuelCard: body.fuelCard || null,
        health: body.health || 100,
        status: normalizeOperationalStatus(body.status || 'RECEIVED') as any,
      },
    });

    return NextResponse.json({ data: truck }, { status: 201 });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'Truck with this plate number already exists' }, { status: 409 });
    }
    console.error('Create truck error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
