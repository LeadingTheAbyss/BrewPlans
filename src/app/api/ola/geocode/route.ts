import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { redis } from '@/lib/redis';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');
  const placeId = searchParams.get('place_id');
  
  if (!address && !placeId) {
    return NextResponse.json({ error: 'Missing address or place_id parameter' }, { status: 400 });
  }

  // Check redis first for geocode/details
  const cacheKey = placeId ? `details:${placeId}` : `geocode:${address?.toLowerCase()}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return NextResponse.json(typeof cached === 'string' ? JSON.parse(cached) : cached);
    }
  } catch (e) {}

  const apiKey = process.env.OLA_MAPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Missing OLA_MAPS_API_KEY' }, { status: 500 });
  }

  try {
    const url = placeId 
      ? `https://api.olamaps.io/places/v1/details?place_id=${placeId}&api_key=${apiKey}`
      : `https://api.olamaps.io/places/v1/geocode?address=${encodeURIComponent(address || '')}&api_key=${apiKey}`;
      
    const res = await fetch(url);
    const data = await res.json();
    
    // Cache to Redis (7 days)
    try {
      await redis.set(cacheKey, JSON.stringify(data), { ex: 604800 });
    } catch (e) {}

    // Save to DB for fuzzy matching later in autocomplete
    let loc = null;
    let nameToSave = address || 'Unknown Place';
    
    if (data.result && data.result.geometry) {
      loc = data.result.geometry.location;
      if (data.result.name) nameToSave = data.result.name;
    } else if (data.geocodingResults && data.geocodingResults.length > 0) {
      loc = data.geocodingResults[0].geometry.location;
    }
    
    if (loc) {
      try {
        await prisma.landmark.create({
          data: {
            name: nameToSave,
            lat: loc.lat,
            lng: loc.lng,
          }
        });
      } catch (e) {
         // Ignore if fails (e.g. schema not pushed yet or duplicate)
      }
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Ola API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
