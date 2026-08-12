import { NextResponse } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { verifyTurnstileToken } from '@/lib/turnstile';
import { checkRateLimit } from '@/lib/rateLimit';

export async function POST(req: Request) {
  try {
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';

    const rateLimit = await checkRateLimit(`quick-login:${ip}`, 3, 900); // max 3 attempts per 15 min per IP
    if (!rateLimit.success) {
      return NextResponse.json({ error: 'Too many login attempts from this network. Please try again later.' }, { status: 429 });
    }

    const body = await req.json();
    const { username, password, turnstileToken } = body;

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password are required.' }, { status: 400 });
    }

    const normalizedUsername = username.trim().toLowerCase();

    // Also throttle per-username, not just per-IP — stops a distributed/proxied
    // attacker from brute-forcing one specific account from many IPs.
    const userRateLimit = await checkRateLimit(`quick-login-user:${normalizedUsername}`, 3, 900);
    if (!userRateLimit.success) {
      return NextResponse.json({ error: 'Too many login attempts for this account. Please try again later.' }, { status: 429 });
    }

    const verified = await verifyTurnstileToken(turnstileToken, ip);
    if (!verified) {
      return NextResponse.json({ error: 'Human verification failed. Please try again.' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { username: normalizedUsername } });
    if (!user || !user.passwordHash) {
      return NextResponse.json({ error: 'Invalid username or password.' }, { status: 401 });
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      return NextResponse.json({ error: 'Invalid username or password.' }, { status: 401 });
    }

    const sessionToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await prisma.session.create({
      data: {
        userId: user.id,
        token: sessionToken,
        expiresAt,
      }
    });

    try {
      const nowIST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
      const today = `${nowIST.getFullYear()}-${String(nowIST.getMonth() + 1).padStart(2, '0')}-${String(nowIST.getDate()).padStart(2, '0')}`;
      if (prisma.dailyUserStat) {
        await prisma.dailyUserStat.upsert({
          where: { userId_date: { userId: user.id, date: today } },
          update: { loginCount: { increment: 1 } },
          create: { userId: user.id, date: today, loginCount: 1 },
        });
      }
    } catch (statError) {
      console.warn("Failed to update daily user stats during quick login:", statError);
    }

    const response = NextResponse.json({ user });
    response.cookies.set('brewplans_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: expiresAt,
      path: '/'
    });

    return response;

  } catch (error) {
    console.error('Quick login error:', error);
    const details = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Internal Server Error', details }, { status: 500 });
  }
}
