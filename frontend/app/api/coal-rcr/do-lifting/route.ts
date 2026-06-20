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

    const records = await prisma.coalDOLifting.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: records });
  } catch (error: any) {
    console.error('Error fetching DO Lifting records:', error);
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

    // Support bulk inserts
    if (Array.isArray(body)) {
      const recordsToCreate = [];
      for (const item of body) {
        const { doNo, ocp, customer, passNo, passDate, truckNo, mineralQty } = item;
        if (!doNo || !passNo || !truckNo || mineralQty === undefined) {
          continue; // Skip invalid records in batch
        }
        recordsToCreate.push({
          doNo: doNo.toUpperCase().trim(),
          ocp: ocp ? ocp.trim() : null,
          customer: customer ? customer.trim() : null,
          passNo: passNo.toUpperCase().trim(),
          passDate: passDate ? passDate.trim() : null,
          truckNo: truckNo.toUpperCase().trim(),
          mineralQty: parseFloat(mineralQty) || 0,
        });
      }

      if (recordsToCreate.length === 0) {
        return NextResponse.json({ error: 'No valid records found in the import payload' }, { status: 400 });
      }

      const result = await prisma.coalDOLifting.createMany({
        data: recordsToCreate,
        skipDuplicates: true,
      });

      return NextResponse.json({ success: true, count: result.count });
    }

    const { id, doNo, ocp, customer, passNo, passDate, truckNo, mineralQty } = body;

    if (!doNo || !passNo || !truckNo || mineralQty === undefined) {
      return NextResponse.json({ error: 'DO No, Pass No, Truck No, and Mineral Qty are required fields' }, { status: 400 });
    }

    const upperDoNo = doNo.toUpperCase().trim();
    const upperPassNo = passNo.toUpperCase().trim();
    const upperTruckNo = truckNo.toUpperCase().trim();

    // Check for duplicate Pass No if this is a new record or a modified Pass No
    const existing = await prisma.coalDOLifting.findUnique({
      where: { passNo: upperPassNo },
    });

    if (existing && (!id || existing.id !== id)) {
      return NextResponse.json({ error: `Pass Number "${upperPassNo}" already exists` }, { status: 409 });
    }

    let record;
    if (id && id.startsWith('lift-') === false) { // check if it is a real DB id or temp client-side id
      record = await prisma.coalDOLifting.update({
        where: { id },
        data: {
          doNo: upperDoNo,
          ocp: ocp ? ocp.trim() : null,
          customer: customer ? customer.trim() : null,
          passNo: upperPassNo,
          passDate: passDate || null,
          truckNo: upperTruckNo,
          mineralQty: parseFloat(mineralQty) || 0,
        },
      });
    } else {
      record = await prisma.coalDOLifting.create({
        data: {
          doNo: upperDoNo,
          ocp: ocp ? ocp.trim() : null,
          customer: customer ? customer.trim() : null,
          passNo: upperPassNo,
          passDate: passDate || null,
          truckNo: upperTruckNo,
          mineralQty: parseFloat(mineralQty) || 0,
        },
      });
    }

    return NextResponse.json({ success: true, data: record });
  } catch (error: any) {
    console.error('Error saving DO Lifting record:', error);
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

    await prisma.coalDOLifting.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting DO Lifting record:', error);
    return NextResponse.json({ error: 'Internal server error: ' + error.message }, { status: 500 });
  }
}
