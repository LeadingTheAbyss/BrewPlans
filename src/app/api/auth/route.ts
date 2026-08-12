import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import crypto from 'crypto';
import { generateUniqueUsername } from '@/lib/username';

function decodeJwt(token: string) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = Buffer.from(base64, 'base64').toString('utf-8');
    return JSON.parse(jsonPayload);
  } catch (error) {
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { token } = body;
    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 400 });
    }

    const payload = decodeJwt(token);
    if (!payload || !payload.email) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
    }

    const email = payload.email;
    const name = payload.name || 'User';
    const picture = payload.picture || null;

    // Find or create user
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      const username = await generateUniqueUsername(name);
      user = await prisma.user.create({
        data: {
          email,
          name,
          picture,
          username,
        }
      });
    } else {
      const updateData: { picture?: string; username?: string } = {};
      // Update the picture if they changed it on Google
      // (Unless they have a custom uploaded picture, but we'll prioritize Google on new login)
      if (picture && user.picture !== picture) {
        updateData.picture = picture;
      }
      // Backfill a username for accounts created before usernames existed
      if (!user.username) {
        updateData.username = await generateUniqueUsername(user.name || name);
      }
      if (Object.keys(updateData).length > 0) {
        user = await prisma.user.update({
          where: { email },
          data: updateData
        });
      }
    }

    // Create a new session
    const sessionToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await prisma.session.create({
      data: {
        userId: user.id,
        token: sessionToken,
        expiresAt,
      }
    });

    // Track daily login - wrapped in try/catch to avoid breaking login if stats fail (e.g. missing db table)
    try {
      const nowIST = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
      const today = `${nowIST.getFullYear()}-${String(nowIST.getMonth()+1).padStart(2,'0')}-${String(nowIST.getDate()).padStart(2,'0')}`;
      if (prisma.dailyUserStat) {
        await prisma.dailyUserStat.upsert({
          where: {
            userId_date: {
              userId: user.id,
              date: today,
            }
          },
          update: {
            loginCount: { increment: 1 }
          },
          create: {
            userId: user.id,
            date: today,
            loginCount: 1,
          }
        });
      }
    } catch (statError) {
      console.warn("Failed to update daily user stats during login:", statError);
    }

    // Set cookie
    const response = NextResponse.json({ user });
    response.cookies.set('brewplans_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: expiresAt,
      path: '/'
    });

    return response;

  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
