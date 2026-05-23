import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const pos = await prisma.purchaseOrder.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ data: pos });
  } catch (error) {
    console.error('Get POs error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
