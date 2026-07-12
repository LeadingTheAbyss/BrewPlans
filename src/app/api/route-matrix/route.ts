import { NextResponse } from 'next/server';

const PYTHON_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8002/api';

export async function POST(req: Request) {
  try {
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
