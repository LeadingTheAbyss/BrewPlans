import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const q = searchParams.get('q');
  
  if (!q) {
    return new NextResponse('Query parameter is required', { status: 400 });
  }
  
  const fallbackType = searchParams.get('fallback') || 'place';
  const fallbackRedirect = fallbackType === 'food'
    ? 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200&q=80'
    : 'https://images.unsplash.com/photo-1570168007204-dfb528c6958f?w=1200&q=80';
    
  const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(q)}&gsrlimit=5&prop=pageimages&pithumbsize=1200&format=json`;
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    const data = await res.json();
    
    let targetImgUrl = fallbackType === 'food' 
      ? 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200&q=80' // High quality food spread
      : 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/Mumbai_03-2016_31_skyline_from_Bandra_Fort.jpg/800px-Mumbai_03-2016_31_skyline_from_Bandra_Fort.jpg';

    const pages = data?.query?.pages;
    if (pages) {
      const pageList = Object.values(pages).sort((a: any, b: any) => (a.index || 99) - (b.index || 99));
      for (const page of pageList as any[]) {
        if (page?.thumbnail?.source) {
          targetImgUrl = page.thumbnail.source;
          break;
        }
      }
    }
    
    // Proxy the image to bypass 403 Forbidden hotlinking restrictions
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

    try {
      const imageRes = await fetch(targetImgUrl, { 
        headers: { 'User-Agent': UA },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!imageRes.ok) {
        throw new Error(`Failed to fetch image: ${imageRes.status}`);
      }

      const imageBuffer = await imageRes.arrayBuffer();
      return new NextResponse(imageBuffer, {
        headers: {
          'Content-Type': imageRes.headers.get('content-type') || 'image/jpeg',
          'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=86400'
        }
      });
    } catch (imgError) {
      clearTimeout(timeoutId);
      console.warn('Image fetch failed, falling back to default:', imgError);
      return NextResponse.redirect(fallbackRedirect);
    }

  } catch (error) {
    console.error('Error fetching wiki image API:', error);
    // Even if the Wikipedia API fails, return a graceful fallback instead of a broken image
    return NextResponse.redirect(fallbackRedirect);
  }
}
