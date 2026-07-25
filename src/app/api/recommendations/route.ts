import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { isAdminEmail } from '@/lib/admin';

const PYTHON_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8002/api';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    let rateLimitExceeded = false;
    // Track recommendation usage & apply rate limits
    try {
      const cookieStore = await cookies();
      const token = cookieStore.get('brewplans_session')?.value;
      if (token) {
        const session = await prisma.session.findUnique({
          where: { token },
          include: { user: true }
        });
        if (session && session.expiresAt >= new Date()) {
          const now = new Date();
          const nowIST = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
          const todayStr = `${nowIST.getFullYear()}-${String(nowIST.getMonth()+1).padStart(2,'0')}-${String(nowIST.getDate()).padStart(2,'0')}`;

          const dailyStat = await prisma.dailyUserStat.findUnique({
            where: { userId_date: { userId: session.userId, date: todayStr } }
          });

          const isAdmin = isAdminEmail(session.user.email);
          if (dailyStat && dailyStat.apiCallsRecommendations >= 50 && !isAdmin) {
            rateLimitExceeded = true;
          } else {
            await prisma.user.update({
              where: { id: session.userId },
              data: {
                apiCalls: { increment: 1 },
                apiCallsRecommendations: { increment: 1 },
                lastApiCallDate: new Date()
              }
            });

            await prisma.dailyUserStat.upsert({
              where: { userId_date: { userId: session.userId, date: todayStr } },
              update: { 
                apiCalls: { increment: 1 },
                apiCallsRecommendations: { increment: 1 }
              },
              create: {
                userId: session.userId,
                date: todayStr,
                apiCalls: 1,
                apiCallsRecommendations: 1
              }
            });
          }
        }
      }
    } catch (e) {
      console.error('Failed to track recommendation API call:', e);
    }

    if (rateLimitExceeded) {
      return NextResponse.json({ error: 'You have reached the limit for Recommend a Trip feature today, higher limits will be available for Pro users soon.' }, { status: 429 });
    }

    const response = await fetch(`${PYTHON_API_URL}/recommendations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store'
    });
    if (!response.ok) {
      throw new Error(`Python API responded with status ${response.status}`);
    }
    // Stream response directly to avoid OOM
    const headers = new Headers();
    headers.set('Content-Type', response.headers.get('content-type') || 'application/json');

    return new NextResponse(response.body as any, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  } catch (error) {
    console.error('Recommendations proxy error:', error);
    return NextResponse.json({ error: 'Failed to fetch recommendations' }, { status: 500 });
  }
}
