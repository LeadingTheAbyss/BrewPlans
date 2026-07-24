import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: Request, { params }: { params: Promise<{ filename: string }> }) {
  const filename = (await params).filename;
  
  // Artifact directory where generate_image saves files
  const artifactDir = "C:\\Users\\Kamlesh Singh\\.gemini\\antigravity-ide\\brain\\eb822406-b628-415d-ba30-e2ce43f87dbb";
  
  // Map friendly names to generated artifact names
  const fileMap: Record<string, string> = {
    'bg_clouds.png': 'bg_clouds_1784844194159.png',
    'bg_earth_night.png': 'bg_earth_night_1784844203159.png',
    'bg_mountains_sunset.png': 'bg_mountains_sunset_1784844212445.png',
    'bg_city_night.png': 'premium_city_night_1784860726925.png'
  };

  const actualFilename = fileMap[filename];
  if (!actualFilename) {
    return new NextResponse('Asset not found in map', { status: 404 });
  }

  const filePath = path.join(artifactDir, actualFilename);
  
  try {
    const fileBuffer = fs.readFileSync(filePath);
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=31536000, immutable'
      },
    });
  } catch (e) {
    console.error("Error reading asset file:", e);
    return new NextResponse('File not found on disk', { status: 404 });
  }
}
