import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createToken, comparePassword } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { email, password, role } = await req.json();

    if (!email || !password || !role) {
      return NextResponse.json({ error: 'Email, password, and selected role are required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

    if (!user || !user.isActive) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const isValid = comparePassword(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    if (user.role !== role) {
      return NextResponse.json(
        { error: `Selected role does not match this account. Please choose ${user.role.replace(/_/g, ' ')}.` },
        { status: 403 }
      );
    }

    const token = await createToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
    });

    return NextResponse.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
