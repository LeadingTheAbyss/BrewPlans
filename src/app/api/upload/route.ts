import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
});

export async function POST(request: NextRequest) {
  try {
    const { filename, contentType } = await request.json();

    if (!filename || !contentType) {
      return NextResponse.json({ error: 'Filename and contentType are required' }, { status: 400 });
    }

    const isVideo = contentType.startsWith('video/');
    const isImage = contentType.startsWith('image/');

    if (!isVideo && !isImage) {
      return NextResponse.json({ error: 'Invalid file type. Only images and videos are allowed.' }, { status: 400 });
    }

    const uniqueFilename = `${Date.now()}-${filename.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9.-]/g, '')}`;
    
    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: uniqueFilename,
      ContentType: contentType,
    });

    // Presigned URL expires in 5 minutes
    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });

    const publicUrl = `${process.env.R2_PUBLIC_URL}/${uniqueFilename}`;

    return NextResponse.json({
      success: true,
      uploadUrl,
      publicUrl,
      type: isVideo ? 'video' : 'image'
    });

  } catch (error) {
    console.error('Presign Error:', error);
    return NextResponse.json({ error: 'Failed to generate upload URL' }, { status: 500 });
  }
}
