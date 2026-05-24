import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const drivers = await prisma.driver.findMany({ select: { id: true, fullName: true, phone: true } });

    const employees = [
      { id: 'emp-admin', name: 'Vikram Sharma', email: 'admin@espl.com', department: 'SYS_ADMIN', salary: 180000, allowance: 0, safetyScore: 100, joinDate: '2025-01-10' },
      { id: 'emp-finance', name: 'Elena Rostova', email: 'finance@espl.com', department: 'FINANCE_OFFICER', salary: 120000, allowance: 0, safetyScore: 100, joinDate: '2025-03-20' },
      { id: 'emp-dispatcher', name: 'Alok Gupta', email: 'dispatcher@espl.com', department: 'DISPATCHER', salary: 85000, allowance: 0, safetyScore: 100, joinDate: '2025-05-15' },
    ];

    drivers.forEach((d, idx) => {
      employees.push({
        id: `emp-drv-${d.id}`,
        name: d.fullName,
        email: `${d.fullName.toLowerCase().replace(/\s+/g, '.')}@espl.com`,
        department: 'DRIVER_PARTNER',
        salary: 35000 + (idx % 5) * 2000,
        allowance: 1200 + (idx % 3) * 300,
        safetyScore: 85 + (idx % 15),
        joinDate: '2025-06-15',
      });
    });

    return NextResponse.json({ data: employees });
  } catch (error) {
    console.error('Get employees error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
