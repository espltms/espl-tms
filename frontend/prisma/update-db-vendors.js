const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const normalizeVendorName = (name) => {
  if (!name) return name;
  const clean = name.trim().toLowerCase();
  
  if (
    clean.includes('espl') ||
    clean.includes('eslp') ||
    clean.includes('eastern') ||
    clean.includes('esatern') ||
    clean.includes('eastrn') ||
    clean.includes('stevedore') ||
    clean.includes('stevidore') ||
    clean.includes('stevedor') ||
    clean.includes('est') ||
    clean.startsWith('east') ||
    clean.startsWith('esat') ||
    clean.includes('vendor 1') ||
    clean.includes('vendor-1') ||
    clean.includes('vendor1') ||
    clean.includes('v1') ||
    clean.includes('v-1')
  ) {
    return 'Eastern Stevedores';
  }
  
  if (
    clean.includes('mahaveer') ||
    clean.includes('mahavir') ||
    clean.includes('mahveer') ||
    clean.includes('mahaver') ||
    clean.includes('mahavver') ||
    clean.startsWith('maha') ||
    clean.includes('vendor 2') ||
    clean.includes('vendor-2') ||
    clean.includes('vendor2') ||
    clean.includes('v2') ||
    clean.includes('v-2')
  ) {
    return 'Mahaveer';
  }
  
  return name.trim();
};

async function main() {
  console.log('Starting DB vendor normalization...');

  // 1. Update Users
  const users = await prisma.user.findMany();
  console.log(`Found ${users.length} users.`);
  for (const user of users) {
    if (user.vendorName) {
      const normalized = normalizeVendorName(user.vendorName);
      if (normalized !== user.vendorName) {
        await prisma.user.update({
          where: { id: user.id },
          data: { vendorName: normalized }
        });
        console.log(`Normalized user ${user.email}: ${user.vendorName} -> ${normalized}`);
      }
    }
  }

  // 2. Update Trips
  const trips = await prisma.trip.findMany();
  console.log(`Found ${trips.length} trips.`);
  let tripUpdateCount = 0;
  for (const trip of trips) {
    if (trip.vendorName) {
      const normalized = normalizeVendorName(trip.vendorName);
      if (normalized !== trip.vendorName) {
        await prisma.trip.update({
          where: { id: trip.id },
          data: { vendorName: normalized }
        });
        tripUpdateCount++;
      }
    }
  }
  console.log(`Normalized ${tripUpdateCount} trips.`);

  // 3. Update Invoices
  const invoices = await prisma.invoice.findMany();
  console.log(`Found ${invoices.length} invoices.`);
  let invoiceUpdateCount = 0;
  for (const invoice of invoices) {
    if (invoice.vendorName) {
      const normalized = normalizeVendorName(invoice.vendorName);
      if (normalized !== invoice.vendorName) {
        await prisma.invoice.update({
          where: { id: invoice.id },
          data: { vendorName: normalized }
        });
        invoiceUpdateCount++;
      }
    }
  }
  console.log(`Normalized ${invoiceUpdateCount} invoices.`);

  console.log('Vendor normalization completed successfully.');
}

main()
  .catch(err => {
    console.error('Error running normalization:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
