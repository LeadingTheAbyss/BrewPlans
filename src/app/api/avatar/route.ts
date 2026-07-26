import { NextResponse } from 'next/server';

export async function GET() {
  const urls = [
    // Fluent UI 3D Emoji
    'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Person%20walking/3D/person_walking_3d.png',
    // Apple 3D Emoji (Fallback)
    'https://em-content.zobj.net/source/apple/391/person-walking_1f6b6.png',
    // Another Fallback
    'https://emojigraph.org/media/apple/person-walking_1f6b6.png'
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        const buffer = await res.arrayBuffer();
        return new NextResponse(buffer, {
          headers: {
            'Content-Type': 'image/png',
            'Cache-Control': 'public, max-age=31536000, immutable',
          },
        });
      }
    } catch (e) {
      console.warn(`Failed to fetch ${url}`, e);
    }
  }

  // Final fallback: return a 1x1 transparent PNG if all fail
  const transparentGif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
  return new NextResponse(transparentGif, {
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
