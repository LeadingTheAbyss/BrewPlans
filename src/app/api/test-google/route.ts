import { NextResponse } from 'next/server';

const PLACES = [
  'Victoria Memorial Kolkata', 'Gateway of India Mumbai', 'Hampi Chariot'
];

async function fetchWikiSearch(title: string) {
  try {
    const res = await fetch(`https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(title)}&prop=pageimages&format=json&pithumbsize=800&gsrlimit=1`, {
      headers: { 'User-Agent': 'GhumiGhumiBot/1.0 (test@example.com)' }
    });
    const data = await res.json();
    const pages = data.query?.pages;
    if (pages) {
      const pageId = Object.keys(pages)[0];
      if (pageId !== '-1' && pages[pageId].thumbnail?.source) {
        return pages[pageId].thumbnail.source;
      }
    }
  } catch (e) {}
  return 'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=800&q=80';
}

export async function GET() {
  let out = 'const PLACES_IMAGES = [\n';
  for (const h of PLACES) {
    const url = await fetchWikiSearch(h);
    out += `  { url: '${url}', label: '${h}', tag: 'Places' },\n`;
    await new Promise(r => setTimeout(r, 600));
  }
  out += '];\n';
  return new NextResponse(out, { headers: { 'Content-Type': 'text/plain' } });
}
