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

const PREMIUM_CITIES = [
  'delhi', 'new delhi', 'mumbai', 'pune', 'jaipur', 'lucknow', 'hyderabad', 'bangalore', 'bengaluru',
  'chennai', 'kolkata', 'agra', 'udaipur', 'goa', 'kochi', 'varanasi', 'srinagar', 'jnk',
  'jammu', 'kashmir', 'amritsar', 'chandigarh', 'ahmedabad', 'surat', 'mysore', 'mysuru',
  'jodhpur', 'jaisalmer', 'rishikesh', 'haridwar', 'shimla', 'manali', 'darjeeling',
  'gangtok', 'shillong', 'guwahati', 'bhubaneswar', 'puri', 'madurai', 'coimbatore',
  'ooty', 'munnar', 'wayanad', 'hampi', 'gokarna', 'pondicherry', 'puducherry', 'andaman',
  'leh', 'ladakh'
];

function isPremiumCity(name: string): boolean {
  const lower = name.toLowerCase();
  return PREMIUM_CITIES.some(city => lower.includes(city));
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const name = searchParams.get('name');

  if (!name) {
    return NextResponse.json({ error: 'Missing name' }, { status: 400 });
  }

  try {
    const cleanName = sanitizeName(name);
    const cacheKey = `google_img_4k_${cleanName.toLowerCase()}`;
    
    // Check Redis cache first
    const cachedUrl = await redis.get(cacheKey);
    let bestUrl: string | null = null;
    
    if (cachedUrl && typeof cachedUrl === 'string') {
      bestUrl = cachedUrl;
    } else {
      const googleKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_KEY;
      if (googleKey) {
        const googleRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': googleKey,
            'X-Goog-FieldMask': 'places.photos'
          },
          body: JSON.stringify({
            textQuery: `${cleanName} city landmark India`,
            languageCode: 'en'
          })
        });

        if (googleRes.ok) {
          const data = await googleRes.json();
          const photoName = data.places?.[0]?.photos?.[0]?.name;
          if (photoName) {
            bestUrl = `https://places.googleapis.com/v1/${photoName}/media?key=${googleKey}&maxWidthPx=1920`;
          }
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
        return NextResponse.redirect('/placeholder-place.svg', {
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
      return NextResponse.redirect('/placeholder-place.svg', { status: 302 });
    }
    return NextResponse.json({ url: null });
  }
}
