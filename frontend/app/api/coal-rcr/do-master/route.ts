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

    const records = await prisma.coalDOMaster.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: records });
  } catch (error: any) {
    console.error('Error fetching DO records:', error);
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
        const { doNo, poNo, month, auctionDate, siding, mines, coalCompany, doQty, coalType, startDate, endDate, permitNo, permitValidDate, tolerance, status, customer, mode } = item;
        if (!doNo || doQty === undefined) {
          continue; // Skip invalid records in batch
        }
        recordsToCreate.push({
          doNo: doNo.toUpperCase().trim(),
          poNo: poNo ? poNo.toUpperCase().trim() : null,
          month: month ? month.trim() : null,
          auctionDate: auctionDate ? auctionDate.trim() : null,
          siding: siding ? siding.trim() : null,
          mines: mines ? mines.trim() : null,
          coalCompany: coalCompany ? coalCompany.trim() : null,
          doQty: parseFloat(doQty) || 0,
          coalType: coalType || 'ROM',
          startDate: startDate || null,
          endDate: endDate || null,
          permitNo: permitNo ? permitNo.toUpperCase().trim() : null,
          permitValidDate: permitValidDate || null,
          tolerance: parseFloat(tolerance) || 0,
          status: status || 'Open',
          customer: customer ? customer.trim() : null,
          mode: mode ? mode.trim() : 'RCR',
        });
      }

      if (recordsToCreate.length === 0) {
        return NextResponse.json({ error: 'No valid records found in the import payload' }, { status: 400 });
      }

      const result = await prisma.coalDOMaster.createMany({
        data: recordsToCreate,
        skipDuplicates: true,
      });

      return NextResponse.json({ success: true, count: result.count });
    }

    const { id, doNo, poNo, month, auctionDate, siding, mines, coalCompany, doQty, coalType, startDate, endDate, permitNo, permitValidDate, tolerance, status, customer, mode } = body;

    if (!doNo || doQty === undefined) {
      return NextResponse.json({ error: 'DO No and DO Qty are required fields' }, { status: 400 });
    }

    const upperDoNo = doNo.toUpperCase().trim();

    // Check for duplicate DO No if this is a new record or a modified DO No
    const existing = await prisma.coalDOMaster.findUnique({
      where: { doNo: upperDoNo },
    });

    if (existing && (!id || existing.id !== id)) {
      return NextResponse.json({ error: `DO Number "${upperDoNo}" already exists` }, { status: 409 });
    }

    let record;
    if (id && id.startsWith('do-') === false) { // check if it is a real DB id or temp client-side id
      record = await prisma.coalDOMaster.update({
        where: { id },
        data: {
          doNo: upperDoNo,
          poNo: poNo ? poNo.toUpperCase().trim() : null,
          month: month ? month.trim() : null,
          auctionDate: auctionDate || null,
          siding: siding || null,
          mines: mines ? mines.trim() : null,
          coalCompany: coalCompany ? coalCompany.trim() : null,
          doQty: parseFloat(doQty) || 0,
          coalType: coalType || 'ROM',
          startDate: startDate || null,
          endDate: endDate || null,
          permitNo: permitNo ? permitNo.toUpperCase().trim() : null,
          permitValidDate: permitValidDate || null,
          tolerance: parseFloat(tolerance) || 0,
          status: status || 'Open',
          customer: customer ? customer.trim() : null,
          mode: mode || 'RCR',
        },
      });
    } else {
      record = await prisma.coalDOMaster.create({
        data: {
          doNo: upperDoNo,
          poNo: poNo ? poNo.toUpperCase().trim() : null,
          month: month ? month.trim() : null,
          auctionDate: auctionDate || null,
          siding: siding || null,
          mines: mines ? mines.trim() : null,
          coalCompany: coalCompany ? coalCompany.trim() : null,
          doQty: parseFloat(doQty) || 0,
          coalType: coalType || 'ROM',
          startDate: startDate || null,
          endDate: endDate || null,
          permitNo: permitNo ? permitNo.toUpperCase().trim() : null,
          permitValidDate: permitValidDate || null,
          tolerance: parseFloat(tolerance) || 0,
          status: status || 'Open',
          customer: customer ? customer.trim() : null,
          mode: mode || 'RCR',
        },
      });
    }

    return NextResponse.json({ success: true, data: record });
  } catch (error: any) {
    console.error('Error saving DO record:', error);
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

    await prisma.coalDOMaster.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting DO record:', error);
    return NextResponse.json({ error: 'Internal server error: ' + error.message }, { status: 500 });
  }
}
