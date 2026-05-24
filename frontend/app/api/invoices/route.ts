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
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
        { vendorName: { contains: search, mode: 'insensitive' } },
        { trip: { tripNumber: { contains: search, mode: 'insensitive' } } },
        { trip: { purchaseOrder: { poNumber: { contains: search, mode: 'insensitive' } } } },
      ];
    }

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: {
          trip: {
            select: {
              tripNumber: true,
              source: true,
              destination: true,
              purchaseOrder: { select: { poNumber: true, clientName: true } },
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.invoice.count({ where }),
    ]);

    return NextResponse.json({ data: invoices, total, page, limit });
  } catch (error) {
    console.error('Get invoices error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
