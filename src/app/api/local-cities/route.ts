import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Memory cache for the server
let cachedCities: any[] | null = null;

export async function GET() {
  if (cachedCities) {
    return NextResponse.json(cachedCities);
  }

  try {
    const filePath = path.join(process.cwd(), 'all_cities.txt');
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    const cities: any[] = [];
    let currentCity: any = null;

    for (const line of lines) {
      if (line.startsWith('📍')) {
        let raw = line.replace('📍', '').trim();
        let name = '';
        let state = '';
        
        let parts = raw.split(/[:,]/).map(p => p.trim());
        let firstPart = parts[0]; 
        
        // Handle "City in State" format
        if (firstPart.includes(' in ')) {
            const splitIn = firstPart.split(' in ');
            name = splitIn[0].trim();
            state = splitIn[1].trim();
            if (state.toLowerCase() === 'india') state = '';
        } else {
            name = firstPart;
        }
        
        // Handle "City, State, India" format
        if (!state && raw.includes(',')) {
            const commaParts = raw.split(',').map(p => p.trim());
            if (commaParts.length >= 3 && commaParts[commaParts.length - 1].toLowerCase() === 'india') {
                state = commaParts[commaParts.length - 2];
            } else if (commaParts.length >= 2) {
                state = commaParts[1];
            }
        }
        
        // Cleanup anomalies
        if (state.toLowerCase() === 'india') state = '';
        if (state.length > 25) state = ''; // Ignore long descriptive text mistakenly caught as state
        
        currentCity = {
           name,
           state,
           display: state ? `${name} (${state})` : name,
        };
      } else if (currentCity && /^[0-9\.\-]+,[0-9\.\-]+$/.test(line)) {
        const [latStr, lngStr] = line.split(',');
        currentCity.lat = parseFloat(latStr);
        currentCity.lng = parseFloat(lngStr);
        currentCity.osrm_coords = `${lngStr},${latStr}`;
        
        // Smart deduplication: merge duplicates by name
        const existingIndex = cities.findIndex(c => c.name.toLowerCase() === currentCity.name.toLowerCase());
        
        if (existingIndex !== -1) {
            // If the existing one is missing a state, but the new one has a state, replace it.
            if (!cities[existingIndex].state && currentCity.state) {
                cities[existingIndex] = currentCity;
            }
            // Otherwise, just ignore the duplicate
        } else {
            cities.push(currentCity);
        }
        currentCity = null;
      }
    }
    
    // Sort alphabetically
    cities.sort((a, b) => a.name.localeCompare(b.name));
    cachedCities = cities;
    
    return NextResponse.json(cities);
  } catch (error) {
    console.error("Failed to parse local cities:", error);
    return NextResponse.json([]);
  }
}
