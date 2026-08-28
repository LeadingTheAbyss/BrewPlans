import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { redis } from '@/lib/redis';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';
import { isAdminEmail } from '@/lib/admin';

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
  const type = searchParams.get('type') || 'city';
  const width = searchParams.get('width') || '1920';

  if (!name) {
    return NextResponse.json({ error: 'Missing name' }, { status: 400 });
  }

  try {
    const cleanName = sanitizeName(name);
    const cacheKey = `google_img_v2_${type}_${cleanName.toLowerCase()}_w${width}`;
    
    // Check Redis cache first
    const cachedUrl = await redis.get(cacheKey);

    let userToTrack = null;
    let todayString = '';

    // Only apply rate limit if it's NOT a cache hit
    if (!cachedUrl) {
      const cookieStore = await cookies();
      const token = cookieStore.get('brewplans_session')?.value;
      
      if (token) {
        const session = await prisma.session.findUnique({
          where: { token },
          include: { user: true }
        });

        if (session && session.expiresAt > new Date()) {
          const user = session.user;
          userToTrack = user;
        }
      }
      
      if (userToTrack) {
        const now = new Date();
        const nowIST = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
        todayString = `${nowIST.getFullYear()}-${String(nowIST.getMonth()+1).padStart(2,'0')}-${String(nowIST.getDate()).padStart(2,'0')}`;
        
        let dailyStat = null;
        if (prisma.dailyUserStat) {
          dailyStat = await prisma.dailyUserStat.findUnique({
            where: { userId_date: { userId: userToTrack.id, date: todayString } }
          });
        }

        const isAdmin = isAdminEmail(userToTrack.email);
        if (!isAdmin) {
          if ((dailyStat?.apiCallsImages || 0) >= 5000) {
            return NextResponse.redirect('https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=1200&q=80'); // Valid fallback
          }
        }
      }
    }
    let bestUrl: string | null = null;
    
    if (cachedUrl && typeof cachedUrl === 'string') {
      bestUrl = cachedUrl;
    } else {
      const googleKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_KEY;
      if (googleKey) {
          let querySuffix = 'city landmark India';
          if (type === 'food') querySuffix = 'dish food India';
          if (type === 'hotel') querySuffix = 'hotel resort India';
          if (type === 'place') querySuffix = 'landmark tourist India';

          const googleRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key': googleKey,
              'X-Goog-FieldMask': 'places.photos'
            },
            body: JSON.stringify({
              textQuery: `${cleanName} ${querySuffix}`,
              languageCode: 'en'
            })
        });

        if (googleRes.ok) {
          const data = await googleRes.json();
          const photos = data.places?.[0]?.photos || [];
          let bestPhoto = photos[0];
          
          // Try to find a high-quality landscape photo
          for (const photo of photos) {
            if (photo.widthPx && photo.heightPx) {
              if (photo.widthPx >= 1920 && photo.widthPx > photo.heightPx) {
                bestPhoto = photo;
                break;
              }
            }
          }
          
          if (bestPhoto?.name) {
            const mediaUrl = `https://places.googleapis.com/v1/${bestPhoto.name}/media?key=${googleKey}&maxWidthPx=${width}&skipHttpRedirect=true`;
            try {
              const mediaRes = await fetch(mediaUrl);
              if (mediaRes.ok) {
                const mediaData = await mediaRes.json();
                if (mediaData.photoUri) {
                  bestUrl = mediaData.photoUri;
                }
              }
            } catch (e) {
               console.error('[destination-photo] Google Media fetch error:', e);
            }
          }
        }
      }
      
      // Wikipedia fallback if Google API failed or was rate limited
      if (!bestUrl) {
        try {
          const wikiRes = await fetch(`https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(cleanName)}&prop=pageimages&format=json&pithumbsize=${width}`);
          if (wikiRes.ok) {
            const wikiData = await wikiRes.json();
            const pages = wikiData?.query?.pages;
            if (pages) {
              const pageId = Object.keys(pages)[0];
              if (pageId && pageId !== '-1' && pages[pageId].thumbnail?.source) {
                bestUrl = pages[pageId].thumbnail.source;
              }
            }
          }
        } catch (e) {
          console.error('[destination-photo] Wiki fetch error:', e);
        }
      }
      
      if (bestUrl) {
        // Save to Redis (cache for 30 days)
        await redis.set(cacheKey, bestUrl, { ex: 2592000 });
        
        if (userToTrack && todayString) {
          if (prisma.dailyUserStat) {
             await prisma.dailyUserStat.upsert({
               where: { userId_date: { userId: userToTrack.id, date: todayString } },
               update: { apiCalls: { increment: 1 }, apiCallsImages: { increment: 1 } },
               create: { userId: userToTrack.id, date: todayString, apiCalls: 1, apiCallsImages: 1 }
             });
          }
          await prisma.user.update({
            where: { id: userToTrack.id },
            data: { apiCalls: { increment: 1 }, lastApiCallDate: new Date() }
          });
        }
      }
    }

    const isRedirect = searchParams.get('redirect') === 'true';

    const finalFallback = 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=1200&q=80';

    if (!bestUrl) {
      if (isRedirect) {
        return NextResponse.redirect(finalFallback, {
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
    const finalFallback = 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=1200&q=80';
    if (searchParams.get('redirect') === 'true') {
      return NextResponse.redirect(finalFallback, { status: 302 });
    }
    return NextResponse.json({ url: null });
  }
}
