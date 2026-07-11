import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

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
    let bestUrl: string | null = null;
    for (const page of pages) {
      const url = page?.thumbnail?.source;
      if (url && !isLikelyBadImage(url)) {
        bestUrl = url;
        break; // Found the best match
      }
    }

    if (!bestUrl) {
      return NextResponse.json({ url: null });
    }

    return NextResponse.json(
      { url: bestUrl },
      { headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=86400' } }
    );
  } catch (err) {
    console.error('[destination-photo] Error:', err);
    return NextResponse.json({ url: null });
  }
}
