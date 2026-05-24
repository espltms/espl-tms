import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getPagination, getSearchParam } from '@/lib/apiQuery';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { page, limit, skip } = getPagination(req);
    const status = getSearchParam(req, 'status');
    const search = getSearchParam(req, 'search');

    const where: any = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { ticketNo: { contains: search, mode: 'insensitive' } },
        { truckPlate: { contains: search, mode: 'insensitive' } },
        { material: { contains: search, mode: 'insensitive' } },
        { sealNumber: { contains: search, mode: 'insensitive' } },
        { trip: { tripNumber: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [tickets, total] = await Promise.all([
      prisma.weighTicket.findMany({
        where,
        include: { trip: { select: { tripNumber: true } } },
        skip,
        take: limit,
        orderBy: { timestamp: 'desc' },
      }),
      prisma.weighTicket.count({ where }),
    ]);

    return NextResponse.json({ data: tickets, total, page, limit });
  } catch (error) {
    console.error('Get weigh tickets error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
