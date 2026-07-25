import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';
import { isAdminEmail } from '@/lib/admin';

const PYTHON_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8002/api';

export async function POST(req: Request) {
  try {
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
      if ((dailyStat?.apiCallsETA || 0) >= 250) {
        return NextResponse.json(
          { error: 'Daily limit reached for Traffic ETAs. Pro upgrade available soon.' }, 
          { status: 429 }
        );
      }
    }

    // Increment usage
    if (prisma.dailyUserStat) {
      await prisma.dailyUserStat.upsert({
        where: { userId_date: { userId: user.id, date: todayString } },
        update: { apiCalls: { increment: 1 }, apiCallsETA: { increment: 1 } },
        create: { userId: user.id, date: todayString, apiCalls: 1, apiCallsETA: 1 }
      });
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { apiCalls: { increment: 1 }, lastApiCallDate: now }
    });

    const body = await req.json();

    const response = await fetch(`${PYTHON_API_URL}/route-matrix`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Python API responded with status ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Route matrix proxy error:', error);
    return NextResponse.json({ error: 'Failed to fetch route matrix' }, { status: 500 });
  }
}
