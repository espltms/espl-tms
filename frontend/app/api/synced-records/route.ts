import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';

const LOCAL_STORAGE_RECORD_TYPE = 'local_storage';

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const recordType = searchParams.get('recordType') || LOCAL_STORAGE_RECORD_TYPE;
  const recordKey = searchParams.get('recordKey');

  if (recordKey) {
    const record = await prisma.syncedRecord.findUnique({
      where: {
        userId_recordType_recordKey: {
          userId: user.userId,
          recordType,
          recordKey,
        },
      },
    });

    return NextResponse.json({ payload: record?.payload ?? null });
  }

  const records = await prisma.syncedRecord.findMany({
    where: { userId: user.userId, recordType },
    orderBy: { updatedAt: 'desc' },
  });

  return NextResponse.json({ records });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const recordType = body.recordType || LOCAL_STORAGE_RECORD_TYPE;
  const { recordKey, payload } = body;

  if (!recordKey) {
    return NextResponse.json({ error: 'recordKey is required' }, { status: 400 });
  }

  const record = await prisma.syncedRecord.upsert({
    where: {
      userId_recordType_recordKey: {
        userId: user.userId,
        recordType,
        recordKey,
      },
    },
    create: {
      userId: user.userId,
      recordType,
      recordKey,
      payload,
    },
    update: {
      payload,
    },
  });

  return NextResponse.json({ record });
}
