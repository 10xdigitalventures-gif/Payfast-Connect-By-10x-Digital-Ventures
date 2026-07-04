import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';

const secret = () => {
  const s = process.env.SESSION_SECRET || 'default_secret_fallback_32_chars_min';
  return new TextEncoder().encode(s);
};

export async function GET() {
  try {
    const result = await query<any[]>('SELECT COUNT(*) as count FROM users WHERE role = \'user\'');
    const userCount = result[0]?.count || 0;

    return NextResponse.json({
      status: 'active',
      message: 'Subaccount login API is active',
      users: userCount,
      endpoints: {
        login: 'POST /api/auth/login',
        logout: 'POST /api/auth/logout',
        register: 'POST /api/auth/register (Admin only)',
      }
    });
  } catch (e) {
    console.error('Login Info Error:', e);
    return NextResponse.json({ error: 'Failed to fetch login info' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password required' }, { status: 400 });
    }

    const users = await query<any[]>(
      'SELECT * FROM users WHERE username = ? AND role = \'user\'', 
      [username]
    );

    if (users.length === 0) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const user = users[0];
    const isValid = await bcrypt.compare(password, user.password);

    if (!isValid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const token = await new SignJWT({ 
      userId: user.id, 
      username: user.username, 
      role: 'user', 
      locationId: user.location_id 
    })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret());

    const response = NextResponse.json({ success: true });
    response.cookies.set('pf_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return response;
  } catch (e) {
    console.error('Login Error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
