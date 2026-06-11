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

    const records = await prisma.coalQualityTracking.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: records });
  } catch (error: any) {
    console.error('Error fetching Quality records:', error);
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
        const { doNo, rrNo, tm, im, ash, vm, fc, gcvAdb, gcvArb, qualityPenalty } = item;
        if (!doNo || !rrNo || qualityPenalty === undefined) {
          continue; // Skip invalid records in batch
        }
        recordsToCreate.push({
          doNo,
          rrNo: rrNo.toUpperCase().trim(),
          tm: parseFloat(tm) || 0,
          im: parseFloat(im) || 0,
          ash: parseFloat(ash) || 0,
          vm: parseFloat(vm) || 0,
          fc: parseFloat(fc) || 0,
          gcvAdb: parseFloat(gcvAdb) || 0,
          gcvArb: parseFloat(gcvArb) || 0,
          qualityPenalty: parseFloat(qualityPenalty) || 0,
        });
      }

      if (recordsToCreate.length === 0) {
        return NextResponse.json({ error: 'No valid records found in the import payload' }, { status: 400 });
      }

      const result = await prisma.coalQualityTracking.createMany({
        data: recordsToCreate,
        skipDuplicates: true,
      });

      return NextResponse.json({ success: true, count: result.count });
    }

    const { id, doNo, rrNo, tm, im, ash, vm, fc, gcvAdb, gcvArb, qualityPenalty } = body;

    if (!doNo || !rrNo || qualityPenalty === undefined) {
      return NextResponse.json({ error: 'DO No, RR No, and Quality Penalty are required fields' }, { status: 400 });
    }

    const upperRrNo = rrNo.toUpperCase().trim();

    // Check duplicate RR No for quality tracking (as each RR is tracked once)
    const existing = await prisma.coalQualityTracking.findUnique({
      where: { rrNo: upperRrNo },
    });

    if (existing && (!id || existing.id !== id)) {
      return NextResponse.json({ error: `Quality Tracking for RR Number "${upperRrNo}" already exists` }, { status: 409 });
    }

    let record;
    if (id && id.startsWith('qt-') === false) { // check if it is a real DB id or temp client-side id
      record = await prisma.coalQualityTracking.update({
        where: { id },
        data: {
          doNo,
          rrNo: upperRrNo,
          tm: parseFloat(tm) || 0,
          im: parseFloat(im) || 0,
          ash: parseFloat(ash) || 0,
          vm: parseFloat(vm) || 0,
          fc: parseFloat(fc) || 0,
          gcvAdb: parseFloat(gcvAdb) || 0,
          gcvArb: parseFloat(gcvArb) || 0,
          qualityPenalty: parseFloat(qualityPenalty) || 0,
        },
      });
    } else {
      record = await prisma.coalQualityTracking.create({
        data: {
          doNo,
          rrNo: upperRrNo,
          tm: parseFloat(tm) || 0,
          im: parseFloat(im) || 0,
          ash: parseFloat(ash) || 0,
          vm: parseFloat(vm) || 0,
          fc: parseFloat(fc) || 0,
          gcvAdb: parseFloat(gcvAdb) || 0,
          gcvArb: parseFloat(gcvArb) || 0,
          qualityPenalty: parseFloat(qualityPenalty) || 0,
        },
      });
    }

    return NextResponse.json({ success: true, data: record });
  } catch (error: any) {
    console.error('Error saving Quality record:', error);
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

    await prisma.coalQualityTracking.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting Quality record:', error);
    return NextResponse.json({ error: 'Internal server error: ' + error.message }, { status: 500 });
  }
}
