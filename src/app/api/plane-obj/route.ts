import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function GET() {
  try {
    const filePath = 'C:\\Users\\Kamlesh Singh\\.gemini\\antigravity-ide\\brain\\b014e7c5-957a-4957-8e14-66f817c5f1aa\\.system_generated\\steps\\411\\content.md';
    let fileContent = await fs.readFile(filePath, 'utf-8');
    
    // The first 4 lines are markdown header added by the tool, we need to strip them.
    const lines = fileContent.split('\n');
    const objContent = lines.slice(4).join('\n');

    return new NextResponse(objContent, {
      headers: {
        'Content-Type': 'text/plain',
        'Cache-Control': 'public, max-age=31536000, immutable'
      },
    });
  } catch (error) {
    console.error('Failed to serve plane obj:', error);
    
    // Fallback to fetch from wayback machine if file is somehow missing
    try {
        const res = await fetch('https://web.archive.org/web/20231201000000id_/https://assets.codepen.io/557388/1405+Plane_1.obj');
        const text = await res.text();
        return new NextResponse(text, {
            headers: {
                'Content-Type': 'text/plain',
                'Cache-Control': 'public, max-age=31536000, immutable'
            },
        });
    } catch(err) {
        return new NextResponse('Error loading OBJ', { status: 500 });
    }
  }
}
