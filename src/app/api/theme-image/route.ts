import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const theme = searchParams.get('theme');
  
  if (!theme) {
    return new NextResponse('Theme parameter is required', { status: 400 });
  }

  const artifactsDir = 'C:\\Users\\Kamlesh Singh\\.gemini\\antigravity-ide\\brain\\a7a79eb2-2d29-419a-b704-a2333ab9ba06';
  
  try {
    const files = fs.readdirSync(artifactsDir);
    const targetFile = files.find(f => f.startsWith(`theme_${theme}_`) && (f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg')));
    
    if (targetFile) {
      const filePath = path.join(artifactsDir, targetFile);
      const imageBuffer = fs.readFileSync(filePath);
      
      const ext = path.extname(targetFile).toLowerCase();
      const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';

      return new NextResponse(imageBuffer, {
        headers: {
          'Content-Type': mimeType,
          'Cache-Control': 'public, max-age=31536000, immutable'
        }
      });
    } else {
      return new NextResponse('Image not found', { status: 404 });
    }
  } catch (error) {
    console.error('Error serving theme image:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
