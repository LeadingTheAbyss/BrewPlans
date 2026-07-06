import { NextResponse } from 'next/server';

const PYTHON_API_URL = 'http://127.0.0.1:8000/api';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';
    const response = await fetch(`${PYTHON_API_URL}/search-city?q=${encodeURIComponent(q)}`);
    if (!response.ok) {
      throw new Error(`Python API responded with status ${response.status}`);
    }
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Search city proxy error:', error);
    return NextResponse.json({ error: 'Failed to fetch city' }, { status: 500 });
  }
}
