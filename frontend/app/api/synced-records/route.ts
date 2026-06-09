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
  'tms_fleet_master',
  'tms_vendor_profiles',
  'tms_subvendor_profiles'
];

const isUserAdmin = (role: string) => 
  role === 'SUPER_ADMIN' || 
  role === 'SYS_ADMIN' || 
  role === 'REGION_ADMIN' || 
  role.endsWith('_ADMIN');

const isUserDispatcher = (role: string) => role === 'DISPATCHER';
const isUserLoader = (role: string) => role.includes('LOADER');
const isUserUnloader = (role: string) => role.includes('UNLOADER');

function canUserWriteRecord(role: string, recordKey: string): boolean {
  if (isUserAdmin(role)) return true;

  switch (recordKey) {
    case 'tms_assigned_trips':
    case 'tms_loading_records':
    case 'tms_local_trucks':
    case 'tms_local_drivers':
      return isUserDispatcher(role);

    case 'tms_truck_status_overrides':
      return isUserDispatcher(role) || isUserLoader(role) || isUserUnloader(role);

    default:
      return false;
  }
}

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
    if (recordKey === 'tms_fleet_master') {
      const trucks = await prisma.truck.findMany({
        orderBy: { createdAt: 'desc' },
      });
      const payload = trucks.map(t => ({
        id: t.id,
        plateNumber: t.plateNumber,
        fleetCategory: t.fleetCategory,
        vendor: t.vendor || '-',
        subVendor: t.subVendor || '-',
        vehicleType: t.type,
        wheeler: t.wheeler || '12 Wheeler',
        rcNo: t.rcNo || '-',
        fitnessValidityFrom: t.fitnessValidityFrom || '-',
        fitnessValidityTo: t.fitnessValidityTo || '-',
        insuranceValidityUpto: t.insuranceValidityUpto || '-',
        pucValidity: t.pucValidity || '-',
        driverName: t.driverName || '-',
        driverDL: t.driverDL || '-',
        dlValidityTill: t.dlValidityTill || '-',
        driverMobile: t.driverMobile || '-',
      }));
      return NextResponse.json({ payload });
    }

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

  // Security check: Verify user has write access to shared data keys
  if (SHARED_KEYS.includes(recordKey)) {
    if (!canUserWriteRecord(user.role, recordKey)) {
      return NextResponse.json({ error: 'Forbidden. You do not have permission to modify this shared data.' }, { status: 403 });
    }
  }

  const effectiveUserId = getEffectiveUserId(user.userId, recordKey);
  await ensureGlobalUserExists(effectiveUserId);

  if (recordKey === 'tms_fleet_master') {
    if (!Array.isArray(payload)) {
      return NextResponse.json({ error: 'Payload must be an array' }, { status: 400 });
    }

    try {
      const platesInPayload = payload
        .filter(item => item && item.plateNumber)
        .map(item => item.plateNumber.toUpperCase().trim());

      await prisma.$transaction(async (tx) => {
        // 1. Upsert all trucks in the payload
        for (const item of payload) {
          if (!item.plateNumber) continue;
          const plate = item.plateNumber.toUpperCase().trim();

          await tx.truck.upsert({
            where: { plateNumber: plate },
            update: {
              fleetCategory: item.fleetCategory || 'OWNED_FLEET',
              vendor: item.vendor || null,
              subVendor: item.subVendor || null,
              type: item.vehicleType || 'Tipper',
              wheeler: item.wheeler || null,
              rcNo: item.rcNo || null,
              fitnessValidityFrom: item.fitnessValidityFrom || null,
              fitnessValidityTo: item.fitnessValidityTo || null,
              insuranceValidityUpto: item.insuranceValidityUpto || null,
              pucValidity: item.pucValidity || null,
              driverName: item.driverName || null,
              driverDL: item.driverDL || null,
              dlValidityTill: item.dlValidityTill || null,
              driverMobile: item.driverMobile || null,
            },
            create: {
              plateNumber: plate,
              model: 'Generic Model',
              capacityTons: 40.0,
              type: item.vehicleType || 'Tipper',
              fleetCategory: item.fleetCategory || 'OWNED_FLEET',
              status: 'AVAILABLE',
              health: 100,
              vendor: item.vendor || null,
              subVendor: item.subVendor || null,
              wheeler: item.wheeler || null,
              rcNo: item.rcNo || null,
              fitnessValidityFrom: item.fitnessValidityFrom || null,
              fitnessValidityTo: item.fitnessValidityTo || null,
              insuranceValidityUpto: item.insuranceValidityUpto || null,
              pucValidity: item.pucValidity || null,
              driverName: item.driverName || null,
              driverDL: item.driverDL || null,
              dlValidityTill: item.dlValidityTill || null,
              driverMobile: item.driverMobile || null,
            },
          });
        }

        // 2. Delete any trucks not in active payload list (excluding trucks with associated trips)
        try {
          await tx.truck.deleteMany({
            where: {
              plateNumber: { notIn: platesInPayload },
              trips: { none: {} },
            },
          });
        } catch (e) {
          console.warn('Omitted trucks deletion skipped for referenced records:', e);
        }
      });

      return NextResponse.json({ record: { recordKey, payload } });
    } catch (err: any) {
      console.error('Sync error:', err);
      return NextResponse.json({ error: 'Sync failed: ' + err.message }, { status: 500 });
    }
  }

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
