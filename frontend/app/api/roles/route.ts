import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET all custom roles
export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const roles = await prisma.customRole.findMany({
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ success: true, roles });
  } catch (error: any) {
    console.error('Error fetching custom roles:', error);
    return NextResponse.json({ error: 'Internal server error: ' + error.message }, { status: 500 });
  }
}

// POST create or update custom role
export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only SUPER_ADMIN and SYS_ADMIN can configure roles
    if (user.role !== 'SUPER_ADMIN' && user.role !== 'SYS_ADMIN') {
      return NextResponse.json({ error: 'Forbidden. Only system admins can manage roles.' }, { status: 403 });
    }

    const { name, routes } = await req.json();

    if (!name || !Array.isArray(routes)) {
      return NextResponse.json({ error: 'Role name and list of routes are required' }, { status: 400 });
    }

    const uppercaseName = name.trim().toUpperCase().replace(/\s+/g, '_');

    // Create or update the custom role
    const customRole = await prisma.customRole.upsert({
      where: { name: uppercaseName },
      update: { routes },
      create: { name: uppercaseName, routes },
    });

    return NextResponse.json({ success: true, role: customRole });
  } catch (error: any) {
    console.error('Error creating custom role:', error);
    return NextResponse.json({ error: 'Internal server error: ' + error.message }, { status: 500 });
  }
}

// DELETE a custom role
export async function DELETE(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only SUPER_ADMIN and SYS_ADMIN can configure roles
    if (user.role !== 'SUPER_ADMIN' && user.role !== 'SYS_ADMIN') {
      return NextResponse.json({ error: 'Forbidden. Only system admins can manage roles.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const roleId = searchParams.get('id');

    if (!roleId) {
      return NextResponse.json({ error: 'Role ID is required' }, { status: 400 });
    }

    await prisma.customRole.delete({
      where: { id: roleId },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting custom role:', error);
    return NextResponse.json({ error: 'Internal server error: ' + error.message }, { status: 500 });
  }
}
