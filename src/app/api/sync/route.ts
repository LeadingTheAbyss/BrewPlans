import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { planId, state } = body;
    if (!planId || !state) {
      return NextResponse.json({ success: false, message: 'Missing planId or state' }, { status: 400 });
    }

    const url = `${process.env.UPSTASH_REDIS_REST_URL}/set/plan_${planId}`;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
       console.error("Missing UPSTASH env vars");
       return NextResponse.json({ success: false, message: 'Server configuration error' }, { status: 500 });
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(state)
    });
    
    if (!res.ok) {
       const text = await res.text();
       console.error("Upstash Error:", text);
       return NextResponse.json({ success: false, error: text }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("Sync POST error:", e);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const planId = searchParams.get('planId');
    if (!planId) {
      return NextResponse.json({ success: false, message: 'Missing planId' }, { status: 400 });
    }

    const url = `${process.env.UPSTASH_REDIS_REST_URL}/get/plan_${planId}`;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
       return NextResponse.json({ success: false, message: 'Server configuration error' }, { status: 500 });
    }

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`
      },
      cache: 'no-store'
    });
    
    if (!res.ok) {
       return NextResponse.json({ success: false }, { status: 500 });
    }

    const data = await res.json();
    let state = null;
    if (data.result) {
        try {
            state = JSON.parse(data.result);
        } catch(e) {
            state = data.result;
        }
    }
    return NextResponse.json({ success: true, state });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
