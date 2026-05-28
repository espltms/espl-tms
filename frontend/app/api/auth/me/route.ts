import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const payload = await getUserFromRequest(req);
  if (!payload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, email: true, fullName: true, role: true, phone: true, regionName: true, vendorName: true, isActive: true },
  });

  if (!user || !user.isActive) {
    return NextResponse.json({ error: 'User not found or inactive' }, { status: 404 });
  }

  return NextResponse.json({ user });
}
