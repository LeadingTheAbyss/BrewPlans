import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

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
      data: {
        slug: data.slug,
        title: data.title,
        excerpt: data.excerpt,
        category: data.category,
        city: data.city,
        categoryIcon: data.categoryIcon || '🌍',
        categoryBadgeBg: data.categoryBadgeBg || 'bg-gray-100',
        categoryBadgeText: data.categoryBadgeText || 'text-gray-800',
        readingTime: data.readingTime,
        
        author: data.author,
        collaborators: data.collaborators || null,
        
        date: data.date,
        imageUrl: data.imageUrl,
        featured: data.featured || false,
        featuredOrder: finalOrder,
        likes: data.likes || 0,
        views: data.views || 0,
        commentsCount: data.commentsCount || 0,
        controversialScore: data.controversialScore || 0,
        timesPlanned: data.timesPlanned || 0,
        
        budget: data.budget || null,
        bestSeason: data.bestSeason || null,
        accommodation: data.accommodation || null,
        transportMode: data.transportMode || null,
        
        itineraryStops: data.itineraryStops || null,
        content: data.content || null,
        mediaType: data.mediaType || null,
        videoUrl: data.videoUrl || null,
        
        comments: data.comments || null,
      }
    });

    return NextResponse.json(blog, { status: 201 });
  } catch (error) {
    console.error('Error creating blog:', error);
    return NextResponse.json({ error: 'Failed to create blog' }, { status: 500 });
  }
}
