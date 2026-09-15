import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { applySessionCookie, createSessionToken } from '@/lib/session';

export async function GET() {
  return NextResponse.json({ status: 'active', endpoint: 'POST /api/auth/login' });
}

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();
    if (!username || !password) return NextResponse.json({ error: 'Username and password required' }, { status: 400 });
    const users = await query<any[]>('SELECT * FROM users WHERE username=? AND role=\'user\' LIMIT 1', [username]);
    const user = users[0];
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }
    const token = await createSessionToken({ userId: user.id, username: user.username, role: 'user', locationId: user.location_id });
    return applySessionCookie(NextResponse.json({ success: true }), token);
  } catch (error) {
    console.error('Login Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
