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

    const [rrRecords, qualityRecords, deductionRecords] = await Promise.all([
      prisma.coalRREntry.findMany({
        orderBy: { createdAt: 'desc' },
      }),
      prisma.coalQualityTracking.findMany(),
      prisma.coalDeductionPenalty.findMany(),
    ]);

    const qualityMap = new Map(qualityRecords.map(q => [q.rrNo, q]));
    const deductionMap = new Map(deductionRecords.map(d => [d.rrNo, d]));

    const data = rrRecords.map(rr => {
      const quality = qualityMap.get(rr.rrNo);
      const deductions = deductionMap.get(rr.rrNo);
      return {
        ...rr,
        quality: quality || null,
        deductions: deductions || null,
      };
    });

    return NextResponse.json({ success: true, data });
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

    if (user.role !== 'SUPER_ADMIN' && user.role !== 'SYS_ADMIN') {
      return NextResponse.json({ error: 'Forbidden. Only Super Admins and System Admins can manage Coal RCR data.' }, { status: 403 });
    }

    const body = await req.json();

    // Support bulk inserts
    if (Array.isArray(body)) {
      let importedCount = 0;

      // 1. Fetch all existing RR numbers in a single query to resolve duplicates
      const existingRRs = await prisma.coalRREntry.findMany({
        select: { id: true, rrNo: true }
      });
      const rrToIdMap = new Map(existingRRs.map(r => [r.rrNo.toUpperCase().trim(), r.id]));

      // Process in chunks of 50 to avoid connection pool exhaustion
      const chunkSize = 50;
      for (let i = 0; i < body.length; i += chunkSize) {
        const chunk = body.slice(i, i + chunkSize);
        await Promise.all(chunk.map(async (item) => {
          const {
            doNo, siding, rrNo, rrDate, invoiceDate, receiptDate, loadingDate,
            from, to, ocp, rrActQty, rrChQty, vllQty, grnQty, normalisedQty,
            noOfWagons, udRemark, quality, deductions,
            fnrNo, inMotionQty, esplTInvNo, esplHInvNo, invDate, tInvAmt, hInvAmt
          } = item;

          if (!doNo || !rrNo || grnQty === undefined) {
            return; // Skip invalid records in batch
          }

          const upperRrNo = rrNo.toUpperCase().trim();
          const existingId = rrToIdMap.get(upperRrNo);

          const rrData = {
            doNo,
            siding: siding ? siding.trim() : '',
            rrNo: upperRrNo,
            rrDate: rrDate || null,
            invoiceDate: invoiceDate || null,
            receiptDate: receiptDate || null,
            loadingDate: loadingDate || null,
            from: from || null,
            to: to || null,
            ocp: ocp || null,
            rrActQty: parseFloat(rrActQty) || 0,
            rrChQty: parseFloat(rrChQty) || 0,
            vllQty: parseFloat(vllQty) || 0,
            grnQty: parseFloat(grnQty) || 0,
            normalisedQty: parseFloat(normalisedQty !== undefined && normalisedQty !== '' ? normalisedQty : grnQty) || 0,
            noOfWagons: noOfWagons ? parseInt(noOfWagons) || null : null,
            udRemark: udRemark || null,
            fnrNo: fnrNo || null,
            inMotionQty: inMotionQty !== undefined && inMotionQty !== null ? parseFloat(inMotionQty) : null,
            esplTInvNo: esplTInvNo || null,
            esplHInvNo: esplHInvNo || null,
            invDate: invDate || null,
            tInvAmt: tInvAmt !== undefined && tInvAmt !== null ? parseFloat(tInvAmt) : null,
            hInvAmt: hInvAmt !== undefined && hInvAmt !== null ? parseFloat(hInvAmt) : null,
          };

          let recordId = existingId;
          if (existingId) {
            await prisma.coalRREntry.update({
              where: { id: existingId },
              data: rrData,
            });
          } else {
            const newRecord = await prisma.coalRREntry.create({
              data: rrData,
            });
            recordId = newRecord.id;
            rrToIdMap.set(upperRrNo, recordId);
            importedCount++;
          }

          if (quality) {
            const qData = {
              doNo,
              rrNo: upperRrNo,
              tm: parseFloat(quality.tm) || 0,
              im: parseFloat(quality.im) || 0,
              ash: parseFloat(quality.ash) || 0,
              vm: parseFloat(quality.vm) || 0,
              fc: parseFloat(quality.fc) || 0,
              gcvAdb: parseFloat(quality.gcvAdb) || 0,
              gcvArb: parseFloat(quality.gcvArb) || 0,
              qualityPenalty: parseFloat(quality.qualityPenalty) || 0,
            };
            await prisma.coalQualityTracking.upsert({
              where: { rrNo: upperRrNo },
              create: qData,
              update: qData,
            });
          }

          if (deductions) {
            const dData = {
              doNo,
              rrNo: upperRrNo,
              pol1: parseFloat(deductions.pol1) || 0,
              pol2: parseFloat(deductions.pol2) || 0,
              enhc: parseFloat(deductions.enhc) || 0,
              dcla: parseFloat(deductions.dcla) || 0,
              fauc: parseFloat(deductions.fauc) || 0,
              deadFreight: parseFloat(deductions.deadFreight) || 0,
              punitive: parseFloat(deductions.punitive) || 0,
              dc: parseFloat(deductions.dc) || 0,
              shortage: parseFloat(deductions.shortage) || 0,
              qualitySlippage: parseFloat(deductions.qualitySlippage) || 0,
              railwayLeakage: parseFloat(deductions.railwayLeakage) || 0,
              mrExclGst: parseFloat(deductions.mrExclGst) || 0,
              finalDeduction: parseFloat(deductions.finalDeduction) || 0,
              remarks: deductions.remarks || null,
            };
            await prisma.coalDeductionPenalty.upsert({
              where: { rrNo: upperRrNo },
              create: dData,
              update: dData,
            });
          }
        }));
      }

      return NextResponse.json({ success: true, count: importedCount });
    }

    const {
      id, doNo, siding, rrNo, rrDate, invoiceDate, receiptDate, loadingDate,
      from, to, ocp, rrActQty, rrChQty, vllQty, grnQty, normalisedQty,
      noOfWagons, udRemark, quality, deductions,
      fnrNo, inMotionQty, esplTInvNo, esplHInvNo, invDate, tInvAmt, hInvAmt
    } = body;

    if (!doNo || !rrNo || grnQty === undefined) {
      return NextResponse.json({ error: 'DO No, RR No, and GRN Qty are required fields' }, { status: 400 });
    }

    const upperRrNo = rrNo.toUpperCase().trim();

    let record: any;
    const rrData = {
      doNo,
      siding: siding ? siding.trim() : '',
      rrNo: upperRrNo,
      rrDate: rrDate || null,
      invoiceDate: invoiceDate || null,
      receiptDate: receiptDate || null,
      loadingDate: loadingDate || null,
      from: from || null,
      to: to || null,
      ocp: ocp || null,
      rrActQty: parseFloat(rrActQty) || 0,
      rrChQty: parseFloat(rrChQty) || 0,
      vllQty: parseFloat(vllQty) || 0,
      grnQty: parseFloat(grnQty) || 0,
      normalisedQty: parseFloat(normalisedQty !== undefined && normalisedQty !== '' ? normalisedQty : grnQty) || 0,
      noOfWagons: noOfWagons ? parseInt(noOfWagons) || null : null,
      udRemark: udRemark || null,
      fnrNo: fnrNo || null,
      inMotionQty: inMotionQty !== undefined && inMotionQty !== null ? parseFloat(inMotionQty) : null,
      esplTInvNo: esplTInvNo || null,
      esplHInvNo: esplHInvNo || null,
      invDate: invDate || null,
      tInvAmt: tInvAmt !== undefined && tInvAmt !== null ? parseFloat(tInvAmt) : null,
      hInvAmt: hInvAmt !== undefined && hInvAmt !== null ? parseFloat(hInvAmt) : null,
    };

    if (id && id.startsWith('rr-') === false) { // check if it is a real DB id or temp client-side id
      record = await prisma.coalRREntry.update({
        where: { id },
        data: rrData,
      });
    } else {
      const existing = await prisma.coalRREntry.findFirst({
        where: { rrNo: upperRrNo },
      });
      if (existing) {
        record = await prisma.coalRREntry.update({
          where: { id: existing.id },
          data: rrData,
        });
      } else {
        record = await prisma.coalRREntry.create({
          data: rrData,
        });
      }
    }

    const promises: any[] = [];
    if (quality) {
      const qData = {
        doNo,
        rrNo: upperRrNo,
        tm: parseFloat(quality.tm) || 0,
        im: parseFloat(quality.im) || 0,
        ash: parseFloat(quality.ash) || 0,
        vm: parseFloat(quality.vm) || 0,
        fc: parseFloat(quality.fc) || 0,
        gcvAdb: parseFloat(quality.gcvAdb) || 0,
        gcvArb: parseFloat(quality.gcvArb) || 0,
        qualityPenalty: parseFloat(quality.qualityPenalty) || 0,
      };
      promises.push(prisma.coalQualityTracking.upsert({
        where: { rrNo: upperRrNo },
        create: qData,
        update: qData,
      }));
    }

    if (deductions) {
      const dData = {
        doNo,
        rrNo: upperRrNo,
        pol1: parseFloat(deductions.pol1) || 0,
        pol2: parseFloat(deductions.pol2) || 0,
        enhc: parseFloat(deductions.enhc) || 0,
        dcla: parseFloat(deductions.dcla) || 0,
        fauc: parseFloat(deductions.fauc) || 0,
        deadFreight: parseFloat(deductions.deadFreight) || 0,
        punitive: parseFloat(deductions.punitive) || 0,
        dc: parseFloat(deductions.dc) || 0,
        shortage: parseFloat(deductions.shortage) || 0,
        qualitySlippage: parseFloat(deductions.qualitySlippage) || 0,
        railwayLeakage: parseFloat(deductions.railwayLeakage) || 0,
        mrExclGst: parseFloat(deductions.mrExclGst) || 0,
        finalDeduction: parseFloat(deductions.finalDeduction) || 0,
        remarks: deductions.remarks || null,
      };
      promises.push(prisma.coalDeductionPenalty.upsert({
        where: { rrNo: upperRrNo },
        create: dData,
        update: dData,
      }));
    }

    if (promises.length > 0) {
      await Promise.all(promises);
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

    if (user.role !== 'SUPER_ADMIN' && user.role !== 'SYS_ADMIN') {
      return NextResponse.json({ error: 'Forbidden. Only Super Admins and System Admins can manage Coal RCR data.' }, { status: 403 });
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
