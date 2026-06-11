const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    console.log("Updating TRIP-10003 and TRIP-10004 to Eastern Stevedores...");
    const updated = await prisma.trip.updateMany({
      where: {
        tripNumber: {
          in: ['TRIP-10003', 'TRIP-10004']
        }
      },
      data: {
        vendorName: 'Eastern Stevedores'
      }
    });
    console.log(`Successfully updated ${updated.count} trips to Eastern Stevedores.`);
  } catch (e) {
    console.error("Error updating inconsistent vendors:", e);
  } finally {
    await prisma.$disconnect();
  }
}

run();
