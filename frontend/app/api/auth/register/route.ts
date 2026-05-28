import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { error: 'Self registration is disabled. Please contact Super Admin to create an account.' },
    { status: 403 }
  );
}
