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

    const records = await prisma.coalDeductionPenalty.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: records });
  } catch (error: any) {
    console.error('Error fetching Deduction records:', error);
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
    const { id, doNo, rrNo, deadFreight, punitive, dc, shortage, qualitySlippage, railwayLeakage, finalDeduction } = body;

    if (!doNo || !rrNo || finalDeduction === undefined) {
      return NextResponse.json({ error: 'DO No, RR No, and Final Deduction are required fields' }, { status: 400 });
    }

    const upperRrNo = rrNo.toUpperCase().trim();

    // Check duplicate RR No for deduction tracking
    const existing = await prisma.coalDeductionPenalty.findUnique({
      where: { rrNo: upperRrNo },
    });

    if (existing && (!id || existing.id !== id)) {
      return NextResponse.json({ error: `Deduction entry for RR Number "${upperRrNo}" already exists` }, { status: 409 });
    }

    let record;
    if (id && id.startsWith('dp-') === false) { // check if it is a real DB id or temp client-side id
      record = await prisma.coalDeductionPenalty.update({
        where: { id },
        data: {
          doNo,
          rrNo: upperRrNo,
          deadFreight: parseFloat(deadFreight) || 0,
          punitive: parseFloat(punitive) || 0,
          dc: parseFloat(dc) || 0,
          shortage: parseFloat(shortage) || 0,
          qualitySlippage: parseFloat(qualitySlippage) || 0,
          railwayLeakage: parseFloat(railwayLeakage) || 0,
          finalDeduction: parseFloat(finalDeduction) || 0,
        },
      });
    } else {
      record = await prisma.coalDeductionPenalty.create({
        data: {
          doNo,
          rrNo: upperRrNo,
          deadFreight: parseFloat(deadFreight) || 0,
          punitive: parseFloat(punitive) || 0,
          dc: parseFloat(dc) || 0,
          shortage: parseFloat(shortage) || 0,
          qualitySlippage: parseFloat(qualitySlippage) || 0,
          railwayLeakage: parseFloat(railwayLeakage) || 0,
          finalDeduction: parseFloat(finalDeduction) || 0,
        },
      });
    }

    return NextResponse.json({ success: true, data: record });
  } catch (error: any) {
    console.error('Error saving Deduction record:', error);
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

    await prisma.coalDeductionPenalty.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting Deduction record:', error);
    return NextResponse.json({ error: 'Internal server error: ' + error.message }, { status: 500 });
  }
}
