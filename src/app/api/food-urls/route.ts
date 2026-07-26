import { NextResponse } from 'next/server';

const foods = [
  { label: 'Naan', tag: 'Bread' },
  { label: 'Gulab Jamun', tag: 'Sweet' },
  { label: 'Aloo Gobi', tag: 'Vegetarian' }
];

export async function GET() {
  const result = [];
  for (const f of foods) {
    let finalUrl = 'error';
    try {
      const url = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(f.label)}&gsrlimit=5&prop=pageimages&pithumbsize=960&format=json`;
      const res = await fetch(url, { headers: { 'User-Agent': 'BrewPlans/1.0' } });
      const data = await res.json();
      const pages = data?.query?.pages;
      if (pages) {
        const pageList = Object.values(pages).sort((a: any, b: any) => (a.index || 99) - (b.index || 99));
        for (const page of pageList as any[]) {
          if (page?.thumbnail?.source) {
            finalUrl = page.thumbnail.source;
            break;
          }
        }
      }
    } catch (e) {}
    result.push({ url: finalUrl, label: f.label, tag: f.tag });
  }
  return NextResponse.json(result);
}
