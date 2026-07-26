import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const BAD_FRAGMENTS = [
  '_map', 'map.', '_flag', '_logo', '_icon', '_seal', '_emblem',
  'coat_of_arms', 'locator', '.svg', '.png',
  'relief', 'topograph', 'terrain', 'topo_', '_topo',
  'physical_map', 'satellite', 'elevation', 'bathymetry',
  'district_map', 'location_map', 'administrative',
  '_plan', 'schematic', 'orthophoto'
];

function isBad(url: string) {
  const lower = url.toLowerCase();
  return BAD_FRAGMENTS.some(f => lower.includes(f));
}

async function getImage(query: string) {
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrlimit=5&prop=pageimages&pithumbsize=1200&format=json`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const data = await res.json();
    const pages = Object.values(data?.query?.pages || {}) as any[];
    pages.sort((a, b) => (a.index || 99) - (b.index || 99));
    for (const p of pages) {
      const img = p?.thumbnail?.source;
      if (img && !isBad(img)) {
        return img;
      }
    }
  } catch (e) {
    console.error(`Error searching for ${query}:`, e);
  }
  return null;
}

const themeQueries = {
  desert: 'Thar Desert',
  beach: 'Radhanagar Beach',
  metropolis: 'Mumbai city',
  skyscrapers: 'Gurgaon city'
};

export async function GET() {
  const artifactsDir = 'C:\\Users\\Kamlesh Singh\\.gemini\\antigravity-ide\\brain\\a7a79eb2-2d29-419a-b704-a2333ab9ba06';
  const logs = [];
  
  try {
    const files = await fs.readdir(artifactsDir);
    for (const file of files) {
      if (file.startsWith('theme_') && (file.endsWith('.jpg') || file.endsWith('.jpeg'))) {
        const filePath = path.join(artifactsDir, file);
        const stats = await fs.stat(filePath);
        if (stats.size < 5000) { // Delete the 1963 byte error files
          await fs.unlink(filePath);
          logs.push(`Deleted bad file ${file} (size: ${stats.size})`);
        }
      }
    }
    
    // Check missing and copy placeholders if needed
    const themes = ['backwaters', 'heritage', 'metropolis'];
    for (const theme of themes) {
      const existing = files.find(f => f.startsWith(`theme_${theme}_`) && f.endsWith('.png'));
      if (!existing) {
        await fs.copyFile(
          path.join(artifactsDir, 'media__1785059514610.png'), // generic high quality placeholder
          path.join(artifactsDir, `theme_${theme}_1_placeholder.png`)
        );
        logs.push(`Copied placeholder for ${theme}`);
      }
    }
    
    logs.push("Cleanup complete");
  } catch (e: any) {
    logs.push(`Error: ${e.message}`);
  }
  
  return NextResponse.json({ success: true, logs });
}
