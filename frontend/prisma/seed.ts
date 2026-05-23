import { PrismaClient } from '@prisma/client';
import tmsData from '../app/data/tms_data.json';
import { hashPassword } from '../lib/auth';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting DB seed...');

  // 1. Create admin user
  const adminEmail = 'admin@espl.com';
  let admin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!admin) {
    admin = await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash: hashPassword('admin123'),
        fullName: 'System Admin',
        role: 'SYS_ADMIN',
      },
    });
    console.log('Created admin user:', admin.email);
  } else {
    console.log('Admin user already exists.');
  }

  // 2. Create Purchase Orders
  console.log('Seeding POs...');
  for (const po of tmsData.purchaseOrders) {
    await prisma.purchaseOrder.upsert({
      where: { poNumber: po.poNumber },
      update: {},
      create: {
        poNumber: po.poNumber,
        clientName: po.clientName,
        commodity: po.commodity,
        totalQuantityTons: po.totalQuantityTons,
        allocatedQuantityTons: po.allocatedQuantityTons,
        ratePerTon: po.ratePerTon,
        status: po.status as any,
      },
    });
  }

  // 3. Create Drivers
  console.log('Seeding Drivers...');
  for (const driver of tmsData.drivers) {
    await prisma.driver.upsert({
      where: { licenseNumber: driver.licenseNumber },
      update: {},
      create: {
        fullName: driver.fullName,
        licenseNumber: driver.licenseNumber,
        phone: driver.phone,
        status: driver.status as any,
        complianceVerified: driver.verified,
      },
    });
  }

  // 4. Create Trucks
  console.log('Seeding Trucks...');
  for (const truck of tmsData.trucks) {
    // extract numeric capacity
    const capacityStr = truck.capacity.replace('T', '');
    const capacityTons = parseFloat(capacityStr) || 0;

    await prisma.truck.upsert({
      where: { plateNumber: truck.plateNumber },
      update: {},
      create: {
        plateNumber: truck.plateNumber,
        model: truck.model,
        type: truck.type,
        capacityTons: capacityTons,
        fuelCard: truck.fuelCard,
        health: truck.health,
        status: truck.status as any,
      },
    });
  }

  // 5. Create Trips
  // For trips we need to map the truck and driver plates/names back to real IDs.
  // We will do a subset of trips for speed (e.g. first 500 if there are thousands).
  console.log('Seeding Trips...');
  const limitTrips = tmsData.trips.slice(0, 500); // adjust as needed
  
  for (const trip of limitTrips) {
    // Find relations
    const dbTruck = await prisma.truck.findUnique({ where: { plateNumber: trip.truck.plateNumber } });
    const dbDriver = await prisma.driver.findFirst({ where: { fullName: trip.driver.fullName } });
    const dbPo = await prisma.purchaseOrder.findUnique({ where: { poNumber: trip.purchaseOrder.poNumber } });

    if (dbTruck && dbDriver && dbPo) {
      await prisma.trip.upsert({
        where: { tripNumber: trip.tripNumber },
        update: {},
        create: {
          tripNumber: trip.tripNumber,
          purchaseOrderId: dbPo.id,
          driverId: dbDriver.id,
          truckId: dbTruck.id,
          source: trip.source,
          destination: trip.destination,
          distanceKm: trip.distanceKm,
          estimatedQuantityTons: trip.estimatedQuantityTons,
          actualLoadedTons: trip.actualLoadedTons || null,
          actualDeliveredTons: trip.actualDeliveredTons || null,
          status: trip.status as any,
          scheduledStartDate: new Date(trip.scheduledStartDate),
        },
      });
    }
  }

  // 6. Create Weigh Tickets
  console.log('Seeding Weigh Tickets...');
  for (const ticket of tmsData.weighTickets.slice(0, 500)) { // limit to first 500
    const dbTrip = await prisma.trip.findUnique({ where: { tripNumber: ticket.tripNo } });
    if (dbTrip) {
      await prisma.weighTicket.upsert({
        where: { ticketNo: ticket.ticketNo },
        update: {},
        create: {
          ticketNo: ticket.ticketNo,
          tripId: dbTrip.id,
          truckPlate: ticket.truckPlate,
          material: ticket.material,
          grossTons: ticket.grossTons,
          tareTons: ticket.tareTons,
          netTons: ticket.netTons,
          sealNumber: ticket.sealNumber,
          status: ticket.status,
          timestamp: new Date(ticket.timestamp),
        },
      });
    }
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
