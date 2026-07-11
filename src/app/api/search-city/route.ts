import { NextResponse } from 'next/server';

const PYTHON_API_URL = 'http://127.0.0.1:8002/api';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';
    const response = await fetch(`${PYTHON_API_URL}/search-city?q=${encodeURIComponent(q)}`, {
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
    console.error('Search city proxy error:', error);
    return NextResponse.json({ error: 'Failed to fetch city' }, { status: 500 });
  }
}
