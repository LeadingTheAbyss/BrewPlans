import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { buildArticleCreateData } from '@/lib/blogArticleData';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const blogs = await prisma.article.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json(blogs);
  } catch (error) {
    console.error('Error fetching blogs:', error);
    return NextResponse.json({ error: 'Failed to fetch blogs' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    
    let finalOrder = data.featuredOrder ? parseInt(data.featuredOrder) : 0;
    if (finalOrder > 0) {
      const maxOrderBlog = await prisma.article.findFirst({
        where: { featuredOrder: { gt: 0 } },
        orderBy: { featuredOrder: 'desc' },
      });
      const maxOrder = maxOrderBlog?.featuredOrder || 0;
      if (finalOrder > maxOrder + 1) {
        finalOrder = maxOrder + 1;
      }
      
      await prisma.article.updateMany({
        where: { featuredOrder: { gte: finalOrder } },
        data: { featuredOrder: { increment: 1 } }
      });
    }
    
    // We want to safely insert JSON
    const blog = await prisma.article.create({
      data: buildArticleCreateData(data, finalOrder)
    });

    return NextResponse.json(blog, { status: 201 });
  } catch (error) {
    console.error('Error creating blog:', error);
    return NextResponse.json({ error: 'Failed to create blog' }, { status: 500 });
  }
}
