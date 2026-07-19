import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { planId, user } = body;
    
    if (!planId || !user || !user.id) {
      return NextResponse.json({ success: false, message: 'Missing planId or user' }, { status: 400 });
    }

    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    const baseUrl = process.env.UPSTASH_REDIS_REST_URL;

    if (!baseUrl || !token) {
       return NextResponse.json({ success: false, message: 'Server configuration error' }, { status: 500 });
    }

    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    // Store user data with timestamp
    const userData = JSON.stringify({ ...user, lastSeen: Date.now() });
    await fetch(`${baseUrl}/hset/presence_${planId}/${user.id}`, {
      method: 'POST',
      headers,
      body: userData
    });
    
    // Set expiry on the hash key to auto-cleanup after 1 minute
    await fetch(`${baseUrl}/expire/presence_${planId}/60`, { headers });

    // Get all users in hash
    const res = await fetch(`${baseUrl}/hgetall/presence_${planId}`, {
      headers,
      cache: 'no-store'
    });
    
    const data = await res.json();
    let activeUsers: any[] = [];
    
    if (data.result && Array.isArray(data.result)) {
       // Upstash hgetall returns flat array: [key1, val1, key2, val2]
       for (let i = 0; i < data.result.length; i += 2) {
          try {
             const u = JSON.parse(data.result[i+1]);
             // Filter out users who haven't pinged in 15 seconds
             if (Date.now() - u.lastSeen < 15000) {
                 activeUsers.push(u);
             }
          } catch(e) {}
       }
    }
    
    return NextResponse.json({ success: true, users: activeUsers });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
