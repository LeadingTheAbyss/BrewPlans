import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const blog = await prisma.article.findUnique({
      where: { id }
    });
    if (!blog) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(blog);
  } catch (error) {
    console.error('Error fetching blog:', error);
    return NextResponse.json({ error: 'Failed to fetch blog' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const data = await request.json();

    const existingBlog = await prisma.article.findUnique({ where: { id } });
    if (!existingBlog) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const oldOrder = existingBlog.featuredOrder || 0;
    let newOrder = data.featuredOrder !== undefined ? parseInt(data.featuredOrder) : oldOrder;

    if (newOrder !== oldOrder) {
      if (newOrder > 0) {
        const maxOrderBlog = await prisma.article.findFirst({
          where: { featuredOrder: { gt: 0 } },
          orderBy: { featuredOrder: 'desc' },
        });
        const maxOrder = maxOrderBlog?.featuredOrder || 0;
        if (newOrder > maxOrder + 1) {
          newOrder = maxOrder + 1;
        }

        if (oldOrder > 0) {
          if (oldOrder < newOrder) {
            await prisma.article.updateMany({
              where: { featuredOrder: { gt: oldOrder, lte: newOrder } },
              data: { featuredOrder: { decrement: 1 } }
            });
          } else {
            await prisma.article.updateMany({
              where: { featuredOrder: { gte: newOrder, lt: oldOrder } },
              data: { featuredOrder: { increment: 1 } }
            });
          }
        } else {
          await prisma.article.updateMany({
            where: { featuredOrder: { gte: newOrder } },
            data: { featuredOrder: { increment: 1 } }
          });
        }
      } else if (oldOrder > 0) {
        await prisma.article.updateMany({
          where: { featuredOrder: { gt: oldOrder } },
          data: { featuredOrder: { decrement: 1 } }
        });
      }
    }

    const updatedBlog = await prisma.article.update({
      where: { id },
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
        featured: data.featured,
        featuredOrder: newOrder,
        likes: data.likes,
        views: data.views,
        commentsCount: data.commentsCount,
        controversialScore: data.controversialScore,
        timesPlanned: data.timesPlanned,
        
        budget: data.budget,
        bestSeason: data.bestSeason,
        accommodation: data.accommodation,
        transportMode: data.transportMode,
        
        itineraryStops: data.itineraryStops,
        content: data.content,
        mediaType: data.mediaType,
        videoUrl: data.videoUrl,
        
        comments: data.comments,
      }
    });

    return NextResponse.json(updatedBlog);
  } catch (error) {
    console.error('Error updating blog:', error);
    return NextResponse.json({ error: 'Failed to update blog' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    
    const existingBlog = await prisma.article.findUnique({ where: { id } });
    if (existingBlog && existingBlog.featuredOrder && existingBlog.featuredOrder > 0) {
       await prisma.article.updateMany({
          where: { featuredOrder: { gt: existingBlog.featuredOrder } },
          data: { featuredOrder: { decrement: 1 } }
       });
    }

    await prisma.article.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting blog:', error);
    return NextResponse.json({ error: 'Failed to delete blog' }, { status: 500 });
  }
}
