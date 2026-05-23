import { SignJWT, jwtVerify } from 'jose';
import { hashSync, compareSync } from 'bcryptjs';
import { NextRequest } from 'next/server';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'espl-tms-default-secret-change-in-production-2026'
);

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  fullName: string;
}

// Create a JWT token
export async function createToken(payload: JWTPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET);
}

// Verify and decode a JWT token
export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

// Extract user from request Authorization header
export async function getUserFromRequest(req: NextRequest): Promise<JWTPayload | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.substring(7);
  return verifyToken(token);
}

// Hash a password
export function hashPassword(password: string): string {
  return hashSync(password, 10);
}

// Compare password with hash
export function comparePassword(password: string, hash: string): boolean {
  return compareSync(password, hash);
}
