import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';
import { isAdminEmail } from '@/lib/admin';

const PYTHON_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8002/api';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const locationId = searchParams.get('location_id');

    if (!locationId) {
      return NextResponse.json({ error: 'location_id is required' }, { status: 400 });
    }

    const cookieStore = await cookies();
    const token = cookieStore.get('brewplans_session')?.value;
    
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const session = await prisma.session.findUnique({
      where: { token },
      include: { user: true }
    });

    if (!session || session.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Unauthorized: Session expired' }, { status: 401 });
    }

    const user = session.user;
    const now = new Date();
    const nowIST = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
    const todayString = `${nowIST.getFullYear()}-${String(nowIST.getMonth()+1).padStart(2,'0')}-${String(nowIST.getDate()).padStart(2,'0')}`;
    
    let dailyStat = null;
    if (prisma.dailyUserStat) {
      dailyStat = await prisma.dailyUserStat.findUnique({
        where: { userId_date: { userId: user.id, date: todayString } }
      });
    }

    const isAdmin = isAdminEmail(user.email);
    if (!isAdmin) {
      if ((dailyStat?.apiCallsReviews || 0) >= 250) {
        return NextResponse.json(
          { error: 'Daily limit reached for Reviews. Pro upgrade available soon.' }, 
          { status: 429 }
        );
      }
    }

    // Increment usage asynchronously
    Promise.all([
      prisma.user.update({
        where: { id: user.id },
        data: { apiCalls: { increment: 1 }, lastApiCallDate: now }
      }),
      prisma.dailyUserStat ? prisma.dailyUserStat.upsert({
        where: { userId_date: { userId: user.id, date: todayString } },
        update: { apiCalls: { increment: 1 }, apiCallsReviews: { increment: 1 } },
        create: { userId: user.id, date: todayString, apiCalls: 1, apiCallsReviews: 1 }
      }) : Promise.resolve()
    ]).catch(console.error);

    const response = await fetch(`${PYTHON_API_URL}/places/reviews?location_id=${encodeURIComponent(locationId)}`, {
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`Python API responded with status ${response.status}`);
    }

    const headers = new Headers();
    headers.set('Content-Type', response.headers.get('content-type') || 'application/json');

    return new NextResponse(response.body as any, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  } catch (error) {
    console.error('Reviews proxy error:', error);
    return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 });
  }
}
