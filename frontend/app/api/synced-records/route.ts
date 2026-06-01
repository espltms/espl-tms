import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';

const LOCAL_STORAGE_RECORD_TYPE = 'local_storage';

const SHARED_KEYS = [
  'tms_assigned_trips',
  'tms_loading_records',
  'tms_local_trucks',
  'tms_local_drivers',
  'tms_truck_status_overrides',
  'tms_custom_roles',
  'tms_fleet_master'
];

const getEffectiveUserId = (userId: string, recordKey: string | null) => {
  if (recordKey && SHARED_KEYS.includes(recordKey)) {
    return 'global-system-data';
  }
  return userId;
};

const ensureGlobalUserExists = async (effectiveUserId: string) => {
  if (effectiveUserId === 'global-system-data') {
    try {
      await prisma.user.upsert({
        where: { id: 'global-system-data' },
        create: {
          id: 'global-system-data',
          email: 'global-system-data@espl.com',
          fullName: 'Global System Data',
          passwordHash: 'GlobalSystemPasswordHashSecretSharedNoAuthNeededForSystemDataKeyMapping',
          role: 'SYS_ADMIN',
          phone: '+919999999999',
        },
        update: {},
      });
    } catch (e) {
      console.error("Error creating global system data user:", e);
    }
  }
};

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const recordType = searchParams.get('recordType') || LOCAL_STORAGE_RECORD_TYPE;
  const recordKey = searchParams.get('recordKey');

  const effectiveUserId = getEffectiveUserId(user.userId, recordKey);
  await ensureGlobalUserExists(effectiveUserId);

  if (recordKey) {
    const record = await prisma.syncedRecord.findUnique({
      where: {
        userId_recordType_recordKey: {
          userId: effectiveUserId,
          recordType,
          recordKey,
        },
      },
    });

    return NextResponse.json({ payload: record?.payload ?? null });
  }

  const records = await prisma.syncedRecord.findMany({
    where: { userId: effectiveUserId, recordType },
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

  const effectiveUserId = getEffectiveUserId(user.userId, recordKey);
  await ensureGlobalUserExists(effectiveUserId);

  const record = await prisma.syncedRecord.upsert({
    where: {
      userId_recordType_recordKey: {
        userId: effectiveUserId,
        recordType,
        recordKey,
      },
    },
    create: {
      userId: effectiveUserId,
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
