import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest, hashPassword } from '@/lib/auth';

// 1. List all users (Super Admin only)
export async function GET(req: NextRequest) {
  try {
    const operator = await getUserFromRequest(req);
    if (!operator) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (operator.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden. Only Super Admins can manage accounts.' }, { status: 403 });
    }

    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        phone: true,
        regionName: true,
        vendorName: true,
        isActive: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ users });
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal server error: ' + error.message }, { status: 500 });
  }
}

// 2. Create a new user (Super Admin only)
export async function POST(req: NextRequest) {
  try {
    const operator = await getUserFromRequest(req);
    if (!operator) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (operator.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden. Only Super Admins can create user accounts.' }, { status: 403 });
    }

    const { email, password, fullName, role, phone, regionName, vendorName } = await req.json();

    if (!email || !password || !fullName || !role) {
      return NextResponse.json({ error: 'Email, password, fullName, and role are required' }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 400 });
    }

    const passwordHash = hashPassword(password);
    const newUser = await prisma.user.create({
      data: {
        email: email.toLowerCase().trim(),
        passwordHash,
        fullName: fullName.trim(),
        role,
        phone: phone || null,
        regionName: regionName || null,
        vendorName: vendorName || null,
        isActive: true,
      },
    });

    return NextResponse.json({
      success: true,
      user: {
        id: newUser.id,
        email: newUser.email,
        fullName: newUser.fullName,
        role: newUser.role,
        regionName: newUser.regionName,
        vendorName: newUser.vendorName,
      },
    });
  } catch (error: any) {
    console.error('User creation error:', error);
    return NextResponse.json({ error: 'Internal server error: ' + error.message }, { status: 500 });
  }
}

// 3. Delete a user (Super Admin only)
export async function DELETE(req: NextRequest) {
  try {
    const operator = await getUserFromRequest(req);
    if (!operator) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (operator.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden. Only Super Admins can delete user accounts.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('id');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    if (userId === operator.userId) {
      return NextResponse.json({ error: 'You cannot delete your own account.' }, { status: 400 });
    }

    await prisma.user.delete({
      where: { id: userId },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal server error: ' + error.message }, { status: 500 });
  }
}
