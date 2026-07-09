import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { redis } from '@/lib/redis';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const input = searchParams.get('input');
  const city = searchParams.get('city');
  
  if (!input || input.length < 3) {
    return NextResponse.json({ error: 'Missing or too short input parameter' }, { status: 400 });
  }

  // 1. Check Redis Cache
  const cacheKey = `autocomplete:${input.toLowerCase()}${city ? ':' + city.toLowerCase() : ''}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return NextResponse.json(typeof cached === 'string' ? JSON.parse(cached) : cached);
    }
  } catch (e) {}

  // 2. DB Fuzzy Matching (check our own Landmarks first)
  try {
    const dbMatches = await prisma.landmark.findMany({
      where: {
        name: {
          contains: input,
          mode: 'insensitive',
        },
        // Only filter by city if provided, to ensure strictness
        ...(city ? { city: { equals: city, mode: 'insensitive' } } : {})
      },
      take: 5,
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (dbMatches.length > 0) {
      // Format to match Ola Maps structure so frontend works seamlessly
      const predictions = dbMatches.map(m => ({
        description: m.name,
        place_id: m.id,
        geometry: {
          location: {
            lat: m.lat,
            lng: m.lng
          }
        },
        structured_formatting: {
          main_text: m.name,
          secondary_text: "Saved Landmark"
        }
      }));
      
      const responseData = { predictions };
      
      // Cache the DB result in Redis too for even faster subsequent lookups
      try {
        await redis.set(cacheKey, JSON.stringify(responseData), { ex: 3600 }); // 1 hour for DB matches
      } catch (e) {}
      
      return NextResponse.json(responseData);
    }
  } catch (e) {
    // If DB fails (e.g. schema not pushed), continue to external API
  }

  const apiKey = process.env.OLA_MAPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Missing OLA_MAPS_API_KEY' }, { status: 500 });
  }

  // 3. Ola Maps API Fallback
  try {
    const searchQuery = city ? `${input}, ${city}` : input;
    const url = `https://api.olamaps.io/places/v1/autocomplete?input=${encodeURIComponent(searchQuery)}&api_key=${apiKey}`;
    const res = await fetch(url);
    const data = await res.json();
    
    // Strict Filtering: If city is provided, strip out any results that aren't in that city
    if (city && data.predictions) {
      data.predictions = data.predictions.filter((p: any) => 
        p.description.toLowerCase().includes(city.toLowerCase())
      );
    }

    // Limit to 5 results to match requirements and speed up UI rendering
    if (data.predictions && data.predictions.length > 5) {
      data.predictions = data.predictions.slice(0, 5);
    }
    
    // 4. Save to Redis Cache
    try {
      await redis.set(cacheKey, JSON.stringify(data), { ex: 604800 }); // 7 days
    } catch (e) {}

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Ola Autocomplete Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
