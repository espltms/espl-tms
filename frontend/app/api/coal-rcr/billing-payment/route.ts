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

    if (user.role !== 'SUPER_ADMIN' && user.role !== 'SYS_ADMIN') {
      return NextResponse.json({ error: 'Forbidden. Only Super Admins and System Admins can access Coal RCR data.' }, { status: 403 });
    }

    const records = await prisma.coalBillingPayment.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: records });
  } catch (error: any) {
    console.error('Error fetching Billing records:', error);
    return NextResponse.json({ error: 'Internal server error: ' + error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'SUPER_ADMIN' && user.role !== 'SYS_ADMIN') {
      return NextResponse.json({ error: 'Forbidden. Only Super Admins and System Admins can manage Coal RCR data.' }, { status: 403 });
    }

    const body = await req.json();
    const { id, doNo, billNo, billDate, billQty, billAmount, tds, advancePaid, finalPayable, remarks } = body;

    if (!doNo || !billNo || finalPayable === undefined) {
      return NextResponse.json({ error: 'DO No, Bill No, and Final Payable are required fields' }, { status: 400 });
    }

    const upperBillNo = billNo.toUpperCase().trim();

    // Check duplicate Bill No
    const existing = await prisma.coalBillingPayment.findUnique({
      where: { billNo: upperBillNo },
    });

    if (existing && (!id || existing.id !== id)) {
      return NextResponse.json({ error: `Bill Number "${upperBillNo}" already exists` }, { status: 409 });
    }

    let record;
    if (id && id.startsWith('bill-') === false) { // check if it is a real DB id or temp client-side id
      record = await prisma.coalBillingPayment.update({
        where: { id },
        data: {
          doNo,
          billNo: upperBillNo,
          billDate,
          billQty: parseFloat(billQty) || 0,
          billAmount: parseFloat(billAmount) || 0,
          tds: parseFloat(tds) || 0,
          advancePaid: parseFloat(advancePaid) || 0,
          finalPayable: parseFloat(finalPayable) || 0,
          remarks: remarks ? remarks.trim() : null,
        },
      });
    } else {
      record = await prisma.coalBillingPayment.create({
        data: {
          doNo,
          billNo: upperBillNo,
          billDate,
          billQty: parseFloat(billQty) || 0,
          billAmount: parseFloat(billAmount) || 0,
          tds: parseFloat(tds) || 0,
          advancePaid: parseFloat(advancePaid) || 0,
          finalPayable: parseFloat(finalPayable) || 0,
          remarks: remarks ? remarks.trim() : null,
        },
      });
    }

    return NextResponse.json({ success: true, data: record });
  } catch (error: any) {
    console.error('Error saving Billing record:', error);
    return NextResponse.json({ error: 'Internal server error: ' + error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'SUPER_ADMIN' && user.role !== 'SYS_ADMIN') {
      return NextResponse.json({ error: 'Forbidden. Only Super Admins and System Admins can manage Coal RCR data.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    await prisma.coalBillingPayment.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting Billing record:', error);
    return NextResponse.json({ error: 'Internal server error: ' + error.message }, { status: 500 });
  }
}
