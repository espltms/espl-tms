import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const page = parseInt(req.nextUrl.searchParams.get('page') || '1');
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '50');

    const [tickets, total] = await Promise.all([
      prisma.weighTicket.findMany({
        include: { trip: { select: { tripNumber: true } } },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { timestamp: 'desc' },
      }),
      prisma.weighTicket.count(),
    ]);

    return NextResponse.json({ data: tickets, total, page, limit });
  } catch (error) {
    console.error('Get weigh tickets error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
