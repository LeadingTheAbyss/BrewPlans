import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name');
  const maxWidth = searchParams.get('maxWidth') || '800';

  if (!name) {
    return new NextResponse('Missing photo name', { status: 400 });
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_KEY;
  if (!apiKey) {
    return new NextResponse('API key not configured', { status: 500 });
  }

  // Construct the official Google Places Media URL
  const googleUrl = `https://places.googleapis.com/v1/${name}/media?key=${apiKey}&maxWidthPx=${maxWidth}&skipHttpRedirect=false`;

  try {
    const response = await fetch(googleUrl, {
      // Don't use Next.js internal fetch cache; we want to cache at the CDN level
      cache: 'no-store' 
    });

    if (!response.ok) {
      console.error(`[ImageProxy] Failed to fetch image: ${response.status} ${response.statusText}`);
      return new NextResponse('Failed to fetch image', { status: response.status });
    }

    const buffer = await response.arrayBuffer();

    // The magical headers that force Edge CDNs (Vercel, Cloudflare, etc.) to cache this globally for 1 year
    const headers = new Headers();
    headers.set('Content-Type', response.headers.get('content-type') || 'image/jpeg');
    headers.set('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, immutable');

    return new NextResponse(buffer, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error(`[ImageProxy] Network error:`, error);
    return new NextResponse('Internal server error', { status: 500 });
  }
}
