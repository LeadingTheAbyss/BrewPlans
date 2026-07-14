import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { redis } from '@/lib/redis';

// Only block obvious non-photo file names.
// Keep this list MINIMAL — bad blacklists cause false positives.
// Wikipedia article cover images are already human-curated, so heavy filtering is unnecessary.
const BAD_FILENAME_FRAGMENTS = [
  '_map', 'map.', '_flag', '_logo', '_icon', '_seal', '_emblem',
  'coat_of_arms', 'locator', '.svg', '.png',
  // Topographic / geographic / satellite imagery — not travel photos
  'relief', 'topograph', 'terrain', 'topo_', '_topo',
  'physical_map', 'satellite', 'elevation', 'bathymetry',
  'district_map', 'location_map', 'administrative',
  '_plan', 'schematic', 'orthophoto',
];

function isLikelyBadImage(url: string): boolean {
  const lower = url.toLowerCase();
  return BAD_FILENAME_FRAGMENTS.some(f => lower.includes(f));
}

function sanitizeName(raw: string): string {
  return raw
    .replace(/\b(vacation|holiday|trip|tour|gateway|getaway|retreat|escape|experience|destination)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const name = searchParams.get('name');

  if (!name) {
    return NextResponse.json({ error: 'Missing name' }, { status: 400 });
  }

  try {
    const cleanName = sanitizeName(name);
    const cacheKey = `wiki_img_${cleanName.toLowerCase()}`;
    
    // Check Redis cache first
    const cachedUrl = await redis.get(cacheKey);
    let bestUrl: string | null = null;
    
    if (cachedUrl && typeof cachedUrl === 'string') {
      bestUrl = cachedUrl;
    } else {
      const headers = { 'User-Agent': 'TripeasyApp/1.0 (travel@example.com)' };

      const wikiGet = async (url: string) => {
        const res = await fetch(url, { headers, cache: 'no-store' });
        if (!res.ok) return null;
        try {
          const json = await res.json();
          return json.error ? null : json;
        } catch {
          return null;
        }
      };

      // Perform a combined search and pageimage lookup for the top 5 results
      const imgData = await wikiGet(
        `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(cleanName + ' India')}&gsrlimit=5&prop=pageimages&pithumbsize=1200&format=json&origin=*`
      );

      const pages = Object.values(imgData?.query?.pages ?? {}) as any[];
      
      // Sort by search relevance index (1 = most relevant)
      pages.sort((a, b) => (a.index || 99) - (b.index || 99));

      // Iterate through the top results to find the first one with a valid, non-blacklisted image
      for (const page of pages) {
        const url = page?.thumbnail?.source;
        if (url && !isLikelyBadImage(url)) {
          bestUrl = url;
          break; // Found the best match
        }
      }
      
      if (bestUrl) {
        // Save to Redis (cache for 30 days)
        await redis.set(cacheKey, bestUrl, { ex: 2592000 });
      }
    }

    const isRedirect = searchParams.get('redirect') === 'true';

    if (!bestUrl) {
      if (isRedirect) {
        return NextResponse.redirect('https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=600&q=80', {
          status: 302,
          headers: { 'Cache-Control': 'public, max-age=86400' }
        });
      }
      return NextResponse.json({ url: null });
    }

    if (isRedirect) {
      return NextResponse.redirect(bestUrl, {
        status: 301,
        headers: { 'Cache-Control': 'public, max-age=864000, immutable' }
      });
    }

    return NextResponse.json(
      { url: bestUrl },
      { headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=86400' } }
    );
  } catch (err) {
    console.error('[destination-photo] Error:', err);
    if (searchParams.get('redirect') === 'true') {
      return NextResponse.redirect('https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=600&q=80', { status: 302 });
    }
    return NextResponse.json({ url: null });
  }
}
