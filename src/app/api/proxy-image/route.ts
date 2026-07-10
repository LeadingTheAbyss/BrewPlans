import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get('url');

  if (!targetUrl) {
    return new NextResponse('Missing url parameter', { status: 400 });
  }

  try {
    const response = await fetch(targetUrl, {
      cache: 'no-store',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
        // Excluding Referer specifically prevents 403 Forbidden from Booking.com, Expedia, and other strict image hosts
      }
    });

    if (!response.ok) {
      console.error(`[ProxyImage] Failed to fetch image: ${response.status} from ${targetUrl}`);
      return new NextResponse(`Failed: ${response.status}`, { status: response.status });
    }

    const headers = new Headers();
    headers.set('Content-Type', response.headers.get('content-type') || 'image/jpeg');
    headers.set('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, immutable');
    headers.set('Access-Control-Allow-Origin', '*');

    // Stream response body instead of allocating arrayBuffer
    return new NextResponse(response.body as any, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error(`[ProxyImage] Network error:`, error);
    return new NextResponse('Internal server error', { status: 500 });
  }
}
