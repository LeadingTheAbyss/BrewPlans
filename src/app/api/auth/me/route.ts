import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';
import { isAdminEmail } from '@/lib/admin';
import { generateUniqueUsername } from '@/lib/username';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('brewplans_session')?.value;

    if (!token) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    const session = await prisma.session.findUnique({
      where: { token },
      include: { user: true }
    });

    if (!session || session.expiresAt < new Date()) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    let sessionUser = session.user;
    if (!sessionUser.username) {
      // Backfills accounts (e.g. older Google logins) created before usernames existed
      const username = await generateUniqueUsername(sessionUser.name);
      sessionUser = await prisma.user.update({ where: { id: sessionUser.id }, data: { username } });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const trips = await prisma.tripHistory.findMany({
      where: {
        userId: sessionUser.id,
        createdAt: {
          gte: today,
        }
      },
      select: { snapshot: true }
    });

    let planTripsToday = 0;
    let quickTripsToday = 0;
    trips.forEach(t => {
      const snap = t.snapshot as any;
      if (snap && snap.type === 'quick-trip') {
        quickTripsToday++;
      } else {
        planTripsToday++;
      }
    });

    const isAdmin = isAdminEmail(sessionUser.email);
    return NextResponse.json({ user: { ...sessionUser, isAdmin, tripsToday: planTripsToday, quickTripsToday } });
  } catch (error) {
    console.error('Me endpoint error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('brewplans_session')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await prisma.session.findUnique({
      where: { token },
      include: { user: true }
    });

    if (!session || session.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { name, picture } = body;

    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        ...(name && { name }),
        ...(picture !== undefined && { picture }) // allow null for picture
      }
    });

    return NextResponse.json({ user: updatedUser });
  } catch (error) {
    console.error('Update profile error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
