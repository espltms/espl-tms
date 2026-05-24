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
        { poNumber: { contains: search, mode: 'insensitive' } },
        { clientName: { contains: search, mode: 'insensitive' } },
        { commodity: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [pos, total] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.purchaseOrder.count({ where }),
    ]);

    return NextResponse.json({ data: pos, total, page, limit });
  } catch (error) {
    console.error('Get POs error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
