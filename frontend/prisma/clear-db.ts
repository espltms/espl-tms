import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Clearing PostgreSQL database demo tables...');
  
  // Delete in order of dependencies to respect foreign key constraints
  await prisma.$transaction([
    prisma.invoice.deleteMany(),
    prisma.weighTicket.deleteMany(),
    prisma.trip.deleteMany(),
    prisma.purchaseOrder.deleteMany(),
    prisma.truck.deleteMany(),
    prisma.driver.deleteMany(),
    prisma.syncedRecord.deleteMany(),
  ]);

  console.log('PostgreSQL database demo tables cleared successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
