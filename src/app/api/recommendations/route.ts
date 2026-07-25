import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';

const PYTHON_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8002/api';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Track recommendation usage
    try {
      const cookieStore = await cookies();
      const token = cookieStore.get('planbro_session')?.value;
      if (token) {
        const session = await prisma.session.findUnique({
          where: { token },
          include: { user: true }
        });
        if (session && session.expiresAt >= new Date()) {
          const now = new Date();
          const nowIST = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
          const todayStr = `${nowIST.getFullYear()}-${String(nowIST.getMonth()+1).padStart(2,'0')}-${String(nowIST.getDate()).padStart(2,'0')}`;

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
    } catch (e) {
      console.error('Failed to track recommendation API call:', e);
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
