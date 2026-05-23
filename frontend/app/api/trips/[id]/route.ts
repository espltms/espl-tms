import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const trip = await prisma.trip.findUnique({
      where: { id: params.id },
      include: {
        driver: true,
        truck: true,
        purchaseOrder: true,
        weighTickets: true,
        invoices: true,
      },
    });
    if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    return NextResponse.json({ data: trip });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    if (body.scheduledStartDate) body.scheduledStartDate = new Date(body.scheduledStartDate);
    if (body.actualStartDate) body.actualStartDate = new Date(body.actualStartDate);
    if (body.actualEndDate) body.actualEndDate = new Date(body.actualEndDate);

    const trip = await prisma.trip.update({ where: { id: params.id }, data: body });
    return NextResponse.json({ data: trip });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await prisma.trip.delete({ where: { id: params.id } });
    return NextResponse.json({ message: 'Deleted' });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
