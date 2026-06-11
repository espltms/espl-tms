const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true
      }
    });

    console.log(`Total Users: ${users.length}`);
    users.forEach((u, i) => {
      console.log(`${i+1}. Email: ${u.email} | Name: ${u.fullName} | Role: ${u.role} | Active: ${u.isActive}`);
    });
  } catch (e) {
    console.error("Error checking users:", e);
  } finally {
    await prisma.$disconnect();
  }
}

run();
