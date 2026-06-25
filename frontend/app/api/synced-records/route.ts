import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';
import { normalizeVendorName } from '@/lib/operationalStatus';

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
  'tms_subvendor_profiles',
  'tms_coal_do_master',
  'tms_coal_rr_entry',
  'tms_coal_quality_tracking',
  'tms_coal_deduction_penalty',
  'tms_coal_billing_payment'
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
      return isUserDispatcher(role) || isUserLoader(role) || isUserUnloader(role);

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

    if (recordKey === 'tms_assigned_trips') {
      const trips = await prisma.trip.findMany({
        include: {
          driver: true,
          truck: true,
          purchaseOrder: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      const payload = trips.map(t => ({
        id: t.id,
        tripNumber: t.tripNumber,
        source: t.source,
        destination: t.destination,
        distanceKm: Number(t.distanceKm),
        estimatedQuantityTons: Number(t.estimatedQuantityTons),
        actualLoadedTons: t.actualLoadedTons ? Number(t.actualLoadedTons) : null,
        actualDeliveredTons: t.actualDeliveredTons ? Number(t.actualDeliveredTons) : null,
        status: t.status,
        scheduledStartDate: t.scheduledStartDate.toISOString(),
        actualStartDate: t.actualStartDate?.toISOString() || null,
        actualEndDate: t.actualEndDate?.toISOString() || null,
        vendorName: t.vendorName,
        vehicleType: t.vehicleType,
        driver: {
          id: t.driverId,
          fullName: t.driver.fullName,
          phone: t.driver.phone,
        },
        truck: {
          id: t.truckId,
          plateNumber: t.truck.plateNumber,
          model: t.truck.model,
        },
        purchaseOrder: {
          id: t.purchaseOrderId,
          poNumber: t.purchaseOrder.poNumber,
          clientName: t.purchaseOrder.clientName,
          commodity: t.purchaseOrder.commodity,
        },
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

      // 1. Upsert all trucks in parallel to avoid interactive transaction timeouts on PgBouncer
      const upsertPromises = payload.map(item => {
        if (!item.plateNumber) return Promise.resolve();
        const plate = item.plateNumber.toUpperCase().trim();

        return prisma.truck.upsert({
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
      });

      await Promise.all(upsertPromises);

      // 2. Delete any trucks not in active payload list (excluding trucks with associated trips)
      try {
        await prisma.truck.deleteMany({
          where: {
            plateNumber: { notIn: platesInPayload },
            trips: { none: {} },
          },
        });
      } catch (e) {
        console.warn('Omitted trucks deletion skipped for referenced records:', e);
      }

      return NextResponse.json({ record: { recordKey, payload } });
    } catch (err: any) {
      console.error('Sync error:', err);
      return NextResponse.json({ error: 'Sync failed: ' + err.message }, { status: 500 });
    }
  }

  if (recordKey === 'tms_assigned_trips') {
    if (!Array.isArray(payload)) {
      return NextResponse.json({ error: 'Payload must be an array' }, { status: 400 });
    }

    try {
      const tripNumbersInPayload = payload
        .filter(item => item && item.tripNumber)
        .map(item => item.tripNumber.toUpperCase().trim());

      // 1. Extract and deduplicate Purchase Orders, Drivers, and Trucks from payload
      const uniquePos = new Map<string, { poNumber: string; clientName?: string; commodity?: string }>();
      const uniqueDrivers = new Map<string, { fullName: string; phone?: string }>();
      const uniqueTrucks = new Map<string, { plateNumber: string; model?: string }>();

      for (const item of payload) {
        if (item.purchaseOrder && item.purchaseOrder.poNumber) {
          const poNo = item.purchaseOrder.poNumber.toUpperCase().trim();
          if (!uniquePos.has(poNo)) {
            uniquePos.set(poNo, {
              poNumber: poNo,
              clientName: item.purchaseOrder.clientName,
              commodity: item.purchaseOrder.commodity,
            });
          }
        }
        if (item.driver && item.driver.fullName) {
          const name = item.driver.fullName.trim();
          if (!uniqueDrivers.has(name)) {
            uniqueDrivers.set(name, {
              fullName: name,
              phone: item.driver.phone,
            });
          }
        }
        if (item.truck && item.truck.plateNumber) {
          const plate = item.truck.plateNumber.toUpperCase().trim();
          if (!uniqueTrucks.has(plate)) {
            uniqueTrucks.set(plate, {
              plateNumber: plate,
              model: item.truck.model,
            });
          }
        }
      }

      // 2. Resolve/Upsert Purchase Orders in parallel
      const poLookup = new Map<string, string>(); // poNumber -> id
      await Promise.all(
        Array.from(uniquePos.values()).map(async (po) => {
          const dbPo = await prisma.purchaseOrder.upsert({
            where: { poNumber: po.poNumber },
            update: {},
            create: {
              poNumber: po.poNumber,
              clientName: po.clientName || 'Generic Client',
              commodity: po.commodity || 'Fly Ash',
              totalQuantityTons: 10000.0,
              ratePerTon: 300.0,
              status: 'ACTIVE',
            },
          });
          poLookup.set(po.poNumber, dbPo.id);
        })
      );

      // 3. Resolve/Create Drivers in parallel
      const driverLookup = new Map<string, string>(); // fullName -> id
      await Promise.all(
        Array.from(uniqueDrivers.values()).map(async (driver) => {
          let dbDriver = await prisma.driver.findFirst({
            where: { fullName: driver.fullName },
          });
          if (!dbDriver) {
            dbDriver = await prisma.driver.create({
              data: {
                fullName: driver.fullName,
                licenseNumber: `DL-${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
                phone: driver.phone || `+9199999${Math.floor(10000 + Math.random() * 90000)}`,
                status: 'AVAILABLE',
              },
            });
          }
          driverLookup.set(driver.fullName, dbDriver.id);
        })
      );

      // 4. Resolve/Upsert Trucks in parallel
      const truckLookup = new Map<string, { id: string; vendor: string; type: string }>(); // plateNumber -> info
      await Promise.all(
        Array.from(uniqueTrucks.values()).map(async (truck) => {
          const dbTruck = await prisma.truck.upsert({
            where: { plateNumber: truck.plateNumber },
            update: {},
            create: {
              plateNumber: truck.plateNumber,
              model: truck.model || 'Generic Model',
              capacityTons: 40.0,
              type: 'Tipper',
              status: 'AVAILABLE',
            },
          });
          truckLookup.set(truck.plateNumber, {
            id: dbTruck.id,
            vendor: dbTruck.vendor || '',
            type: dbTruck.type || '',
          });
        })
      );

      // 5. Upsert Trips in parallel using resolved lookups
      const tripPromises = payload.map(async (item) => {
        if (!item.tripNumber) return;
        const tripNo = item.tripNumber.toUpperCase().trim();

        const poNo = item.purchaseOrder?.poNumber?.toUpperCase().trim();
        const driverName = item.driver?.fullName?.trim();
        const truckPlate = item.truck?.plateNumber?.toUpperCase().trim();

        const dbPoId = poNo ? poLookup.get(poNo) : null;
        const dbDriverId = driverName ? driverLookup.get(driverName) : null;
        const truckInfo = truckPlate ? truckLookup.get(truckPlate) : null;

        if (!dbPoId || !dbDriverId || !truckInfo) {
          return;
        }

        const resolvedVendorName = truckInfo.vendor
          ? normalizeVendorName(truckInfo.vendor)
          : item.vendorName
            ? normalizeVendorName(item.vendorName)
            : null;
        const resolvedVehicleType = truckInfo.type || item.vehicleType || null;

        await prisma.trip.upsert({
          where: { tripNumber: tripNo },
          update: {
            purchaseOrderId: dbPoId,
            driverId: dbDriverId,
            truckId: truckInfo.id,
            source: item.source || 'Lanjigarh',
            destination: item.destination || 'Paramanandpur',
            distanceKm: item.distanceKm || 0,
            estimatedQuantityTons: item.estimatedQuantityTons || 0,
            actualLoadedTons: item.actualLoadedTons || null,
            actualDeliveredTons: item.actualDeliveredTons || null,
            status: item.status || 'SCHEDULED',
            scheduledStartDate: new Date(item.scheduledStartDate || Date.now()),
            actualStartDate: item.actualStartDate ? new Date(item.actualStartDate) : null,
            actualEndDate: item.actualEndDate ? new Date(item.actualEndDate) : null,
            vendorName: resolvedVendorName,
            vehicleType: resolvedVehicleType,
          },
          create: {
            tripNumber: tripNo,
            purchaseOrderId: dbPoId,
            driverId: dbDriverId,
            truckId: truckInfo.id,
            source: item.source || 'Lanjigarh',
            destination: item.destination || 'Paramanandpur',
            distanceKm: item.distanceKm || 0,
            estimatedQuantityTons: item.estimatedQuantityTons || 0,
            actualLoadedTons: item.actualLoadedTons || null,
            actualDeliveredTons: item.actualDeliveredTons || null,
            status: item.status || 'SCHEDULED',
            scheduledStartDate: new Date(item.scheduledStartDate || Date.now()),
            actualStartDate: item.actualStartDate ? new Date(item.actualStartDate) : null,
            actualEndDate: item.actualEndDate ? new Date(item.actualEndDate) : null,
            vendorName: resolvedVendorName,
            vehicleType: resolvedVehicleType,
          },
        });
      });

      await Promise.all(tripPromises);

      return NextResponse.json({ record: { recordKey, payload } });
    } catch (err: any) {
      console.error('Trips sync error:', err);
      return NextResponse.json({ error: 'Trips sync failed: ' + err.message }, { status: 500 });
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
