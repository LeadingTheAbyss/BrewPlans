import { NextResponse } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { verifyTurnstileToken } from '@/lib/turnstile';
import { checkRateLimit } from '@/lib/rateLimit';

const USERNAME_PATTERN = /^[a-z0-9_-]{3,20}$/;

export async function POST(req: Request) {
  try {
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';

    const rateLimit = await checkRateLimit(`quick-signup:${ip}`, 3, 3600); // max 3 quick accounts per hour per IP — keeps bots from farming fake accounts
    if (!rateLimit.success) {
      return NextResponse.json({ error: 'Too many accounts created from this network. Please try again later.' }, { status: 429 });
    }

    const body = await req.json();
    const { username, password, turnstileToken } = body;

    if (!username || !password) {
      return NextResponse.json({ error: 'Please choose a username and password.' }, { status: 400 });
    }

    const normalizedUsername = String(username).trim().toLowerCase();
    if (!USERNAME_PATTERN.test(normalizedUsername)) {
      return NextResponse.json({ error: 'Username must be 3-20 characters — letters, numbers, hyphens, or underscores only.' }, { status: 400 });
    }
    if (String(password).length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 });
    }

    const verified = await verifyTurnstileToken(turnstileToken, ip);
    if (!verified) {
      return NextResponse.json({ error: 'Human verification failed. Please try again.' }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { username: normalizedUsername } });
    if (existing) {
      return NextResponse.json({ error: 'That username is already taken. Please choose another.' }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    let user;
    try {
      user = await prisma.user.create({
        data: {
          // Synthetic, never-emailed placeholder — quick accounts don't collect a real email.
          email: `${normalizedUsername}@quick.brewplans.local`,
          name: normalizedUsername,
          username: normalizedUsername,
          passwordHash,
          authProvider: 'quick',
        }
      });
    } catch (createError: unknown) {
      // Two requests can both pass the findUnique check above before either
      // commits — the DB's unique constraint on `username` is what actually
      // guarantees no duplicates; this just turns that race into a friendly
      // message instead of a raw 500.
      if (
        createError &&
        typeof createError === 'object' &&
        'code' in createError &&
        (createError as { code: string }).code === 'P2002'
      ) {
        return NextResponse.json({ error: 'That username is already taken. Please choose another.' }, { status: 409 });
      }
      throw createError;
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
      console.warn("Failed to update daily user stats during quick signup:", statError);
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
    console.error('Quick signup error:', error);
    const details = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Internal Server Error', details }, { status: 500 });
  }
}
