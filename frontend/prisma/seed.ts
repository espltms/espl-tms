import { PrismaClient } from '@prisma/client';
import tmsData from '../app/data/tms_data.json';
import { hashPassword } from '../lib/auth';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting DB seed...');

  // 1. Create users
  const users = [
    {
      email: 'superadmin@espl.com',
      password: 'TMSAdminPassword2026!',
      fullName: 'Super Admin',
      role: 'SUPER_ADMIN',
    },
    {
      email: 'sysadmin@espl.com',
      password: 'TMSAdminPassword2026!',
      fullName: 'System Admin',
      role: 'SYS_ADMIN',
    },

    {
      email: 'bhawanipatna.admin@espl.com',
      password: 'TMSAdminPassword2026!',
      fullName: 'Bhawanipatna Admin',
      role: 'BHAWANIPATNA_ADMIN',
      regionName: 'Bhawanipatna',
    },
    {
      email: 'lanjigarh.loader@espl.com',
      password: 'TMSAdminPassword2026!',
      fullName: 'Lanjigarh Loader',
      role: 'LANJIGARH_LOADER',
      regionName: 'Lanjigarh',
    },
    {
      email: 'paramanandpur.unloader@espl.com',
      password: 'TMSAdminPassword2026!',
      fullName: 'Paramanandpur Unloader',
      role: 'PARAMANANDPUR_UNLOADER',
      regionName: 'Paramanandpur',
    },
    {
      email: 'dharamgarh.unloader@espl.com',
      password: 'TMSAdminPassword2026!',
      fullName: 'Dharamgarh Unloader',
      role: 'DHARAMGARH_UNLOADER',
      regionName: 'Dharamgarh',
    },
    {
      email: 'vendor1@espl.com',
      password: 'TMSAdminPassword2026!',
      fullName: 'Vendor -1',
      role: 'VENDOR_1',
      vendorName: 'Eastern Stevedores',
    },
    {
      email: 'vendor2@espl.com',
      password: 'TMSAdminPassword2026!',
      fullName: 'Vendor -2',
      role: 'VENDOR_2',
      vendorName: 'Mahaveer',
    },
    {
      email: 'vendor3@espl.com',
      password: 'TMSAdminPassword2026!',
      fullName: 'Vendor -3',
      role: 'VENDOR_3',
      vendorName: 'Vendor 3',
    },
    {
      email: 'vendor4@espl.com',
      password: 'TMSAdminPassword2026!',
      fullName: 'Vendor -4',
      role: 'VENDOR_4',
      vendorName: 'Vendor 4',
    },
    {
      email: 'vendor5@espl.com',
      password: 'TMSAdminPassword2026!',
      fullName: 'Vendor -5',
      role: 'VENDOR_5',
      vendorName: 'Vendor 5',
    },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {
        role: u.role,
        fullName: u.fullName,
        regionName: (u as any).regionName || null,
        vendorName: (u as any).vendorName || null,
      },
      create: {
        email: u.email,
        passwordHash: hashPassword(u.password),
        fullName: u.fullName,
        role: u.role,
        regionName: (u as any).regionName || null,
        vendorName: (u as any).vendorName || null,
      },
    });
    console.log('Upserted user:', u.email);
  }

  // 2. Create Purchase Orders
  console.log('Seeding POs...');
  const existingPOs = await prisma.purchaseOrder.findMany({ select: { poNumber: true, id: true } });
  const existingPOMap = new Map(existingPOs.map(po => [po.poNumber, po.id]));
  for (const po of tmsData.purchaseOrders) {
    if (!existingPOMap.has(po.poNumber)) {
      await prisma.purchaseOrder.create({
        data: {
          poNumber: po.poNumber,
          clientName: po.clientName,
          commodity: po.commodity,
          totalQuantityTons: po.totalQuantityTons,
          allocatedQuantityTons: po.allocatedQuantityTons,
          ratePerTon: po.ratePerTon,
          status: po.status as any,
        }
      });
    }
  }

  // 3. Drivers are managed manually via the app UI — not seeded from demo data
  // console.log('Seeding Drivers...');
  // (Driver seeding removed — add real drivers through Driver Duty Logs UI)

  // 4. Create Trucks
  console.log('Seeding Trucks...');
  const existingTrucks = await prisma.truck.findMany({ select: { plateNumber: true, id: true } });
  const existingTruckMap = new Map(existingTrucks.map(t => [t.plateNumber, t.id]));
  
  const trucksToCreate = [];
  for (const truck of tmsData.trucks) {
    if (!existingTruckMap.has(truck.plateNumber)) {
      const capacityStr = truck.capacity.replace('T', '');
      const capacityTons = parseFloat(capacityStr) || 0;
      trucksToCreate.push({
        plateNumber: truck.plateNumber,
        model: truck.model,
        type: truck.type,
        capacityTons: capacityTons,
        fuelCard: truck.fuelCard,
        health: truck.health,
        status: truck.status as any,
      });
    }
  }
  if (trucksToCreate.length > 0) {
    await prisma.truck.createMany({ data: trucksToCreate });
    console.log(`Created ${trucksToCreate.length} new trucks.`);
  }

  // 5. Create Trips
  // For trips we need to map the truck and driver plates/names back to real IDs.
  // We will do a subset of trips for speed (e.g. first 500 if there are thousands).
  console.log('Seeding Trips...');
  const allTrucks = await prisma.truck.findMany({ select: { plateNumber: true, id: true } });
  const truckMap = new Map(allTrucks.map(t => [t.plateNumber, t.id]));
  const allDrivers = await prisma.driver.findMany({ select: { fullName: true, id: true } });
  const driverMap = new Map(allDrivers.map(d => [d.fullName, d.id]));
  const allPOs = await prisma.purchaseOrder.findMany({ select: { poNumber: true, id: true } });
  const poMap = new Map(allPOs.map(po => [po.poNumber, po.id]));
  
  const existingTrips = await prisma.trip.findMany({ select: { tripNumber: true } });
  const existingTripSet = new Set(existingTrips.map(t => t.tripNumber));

  const limitTrips = tmsData.trips.slice(0, 500); // adjust as needed
  const tripsToCreate = [];
  for (const trip of limitTrips) {
    if (existingTripSet.has(trip.tripNumber)) continue;
    const dbTruckId = truckMap.get(trip.truck.plateNumber);
    const dbDriverId = driverMap.get(trip.driver.fullName);
    const dbPoId = poMap.get(trip.purchaseOrder.poNumber);

    if (dbTruckId && dbDriverId && dbPoId) {
      tripsToCreate.push({
        tripNumber: trip.tripNumber,
        purchaseOrderId: dbPoId,
        driverId: dbDriverId,
        truckId: dbTruckId,
        source: trip.source,
        destination: trip.destination,
        distanceKm: trip.distanceKm,
        estimatedQuantityTons: trip.estimatedQuantityTons,
        actualLoadedTons: trip.actualLoadedTons || null,
        actualDeliveredTons: trip.actualDeliveredTons || null,
        status: trip.status as any,
        scheduledStartDate: new Date(trip.scheduledStartDate),
      });
    }
  }
  if (tripsToCreate.length > 0) {
    await prisma.trip.createMany({ data: tripsToCreate });
    console.log(`Created ${tripsToCreate.length} new trips.`);
  }

  // 6. Create Weigh Tickets
  console.log('Seeding Weigh Tickets...');
  const allTrips = await prisma.trip.findMany({ select: { tripNumber: true, id: true } });
  const tripMap = new Map(allTrips.map(t => [t.tripNumber, t.id]));
  
  const existingTickets = await prisma.weighTicket.findMany({ select: { ticketNo: true } });
  const existingTicketSet = new Set(existingTickets.map(t => t.ticketNo));

  const ticketsToCreate = [];
  for (const ticket of tmsData.weighTickets.slice(0, 500)) { // limit to first 500
    if (existingTicketSet.has(ticket.ticketNo)) continue;
    const dbTripId = tripMap.get(ticket.tripNo);
    if (dbTripId) {
      ticketsToCreate.push({
        ticketNo: ticket.ticketNo,
        tripId: dbTripId,
        truckPlate: ticket.truckPlate,
        material: ticket.material,
        grossTons: ticket.grossTons,
        tareTons: ticket.tareTons,
        netTons: ticket.netTons,
        sealNumber: ticket.sealNumber,
        status: ticket.status,
        timestamp: new Date(ticket.timestamp),
      });
    }
  }
  if (ticketsToCreate.length > 0) {
    await prisma.weighTicket.createMany({ data: ticketsToCreate });
    console.log(`Created ${ticketsToCreate.length} new weigh tickets.`);
  }

  console.log('Seed completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
