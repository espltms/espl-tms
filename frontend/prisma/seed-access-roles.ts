import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../lib/auth';

const prisma = new PrismaClient();
const passwordHash = hashPassword('TMSAdminPassword2026!');

const users = [
  { email: 'superadmin@espl.com', fullName: 'Super Admin', role: 'SUPER_ADMIN', regionName: null, vendorName: null },
  { email: 'place1.admin@espl.com', fullName: 'Place 1 Admin', role: 'REGION_ADMIN', regionName: 'Place-1', vendorName: null },
  { email: 'place2.admin@espl.com', fullName: 'Place 2 Admin', role: 'REGION_ADMIN', regionName: 'Place-2', vendorName: null },
  { email: 'place3.admin@espl.com', fullName: 'Place 3 Admin', role: 'REGION_ADMIN', regionName: 'Place-3', vendorName: null },
  { email: 'place4.admin@espl.com', fullName: 'Place 4 Admin', role: 'REGION_ADMIN', regionName: 'Place-4', vendorName: null },
  { email: 'place5.admin@espl.com', fullName: 'Place 5 Admin', role: 'REGION_ADMIN', regionName: 'Place-5', vendorName: null },
  { email: 'vendor1@espl.com', fullName: 'Vendor 1', role: 'VENDOR', regionName: null, vendorName: 'Vendor 1' },
  { email: 'vendor2@espl.com', fullName: 'Vendor 2', role: 'VENDOR', regionName: null, vendorName: 'Vendor 2' },
  { email: 'vendor3@espl.com', fullName: 'Vendor 3', role: 'VENDOR', regionName: null, vendorName: 'Vendor 3' },
];

async function main() {
  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        fullName: user.fullName,
        role: user.role as any,
        regionName: user.regionName,
        vendorName: user.vendorName,
        isActive: true,
      },
      create: {
        ...user,
        role: user.role as any,
        passwordHash,
        isActive: true,
      },
    });
  }

  await prisma.user.updateMany({
    where: {
      email: {
        in: [
          'admin@espl.com',
          'admin@logistics.com',
          'dispatcher@logistics.com',
          'compliance@logistics.com',
          'finance@logistics.com',
          'gate@logistics.com',
        ],
      },
    },
    data: { isActive: false },
  });

  console.log('Seeded new access-role accounts.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
