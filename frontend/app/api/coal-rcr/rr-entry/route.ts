import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden. Only Super Admins can access Coal RCR data.' }, { status: 403 });
    }

    const records = await prisma.coalRREntry.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: records });
  } catch (error: any) {
    console.error('Error fetching RR records:', error);
    return NextResponse.json({ error: 'Internal server error: ' + error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden. Only Super Admins can manage Coal RCR data.' }, { status: 403 });
    }

    const body = await req.json();
    const { id, doNo, siding, rrNo, rrDate, loadingDate, receiptDate, rrActQty, rrChQty, vllQty, grnQty, normalisedQty } = body;

    if (!doNo || !rrNo || grnQty === undefined) {
      return NextResponse.json({ error: 'DO No, RR No, and GRN Qty are required fields' }, { status: 400 });
    }

    const upperRrNo = rrNo.toUpperCase().trim();

    // Check for duplicate RR No
    const existing = await prisma.coalRREntry.findUnique({
      where: { rrNo: upperRrNo },
    });

    if (existing && (!id || existing.id !== id)) {
      return NextResponse.json({ error: `RR Number "${upperRrNo}" already exists` }, { status: 409 });
    }

    let record;
    if (id && id.startsWith('rr-') === false) { // check if it is a real DB id or temp client-side id
      record = await prisma.coalRREntry.update({
        where: { id },
        data: {
          doNo,
          siding: siding.trim(),
          rrNo: upperRrNo,
          rrDate,
          loadingDate,
          receiptDate,
          rrActQty: parseFloat(rrActQty) || 0,
          rrChQty: parseFloat(rrChQty) || 0,
          vllQty: parseFloat(vllQty) || 0,
          grnQty: parseFloat(grnQty) || 0,
          normalisedQty: parseFloat(normalisedQty !== undefined && normalisedQty !== '' ? normalisedQty : grnQty) || 0,
        },
      });
    } else {
      record = await prisma.coalRREntry.create({
        data: {
          doNo,
          siding: siding.trim(),
          rrNo: upperRrNo,
          rrDate,
          loadingDate,
          receiptDate,
          rrActQty: parseFloat(rrActQty) || 0,
          rrChQty: parseFloat(rrChQty) || 0,
          vllQty: parseFloat(vllQty) || 0,
          grnQty: parseFloat(grnQty) || 0,
          normalisedQty: parseFloat(normalisedQty !== undefined && normalisedQty !== '' ? normalisedQty : grnQty) || 0,
        },
      });
    }

    return NextResponse.json({ success: true, data: record });
  } catch (error: any) {
    console.error('Error saving RR record:', error);
    return NextResponse.json({ error: 'Internal server error: ' + error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden. Only Super Admins can manage Coal RCR data.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    await prisma.coalRREntry.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting RR record:', error);
    return NextResponse.json({ error: 'Internal server error: ' + error.message }, { status: 500 });
  }
}
