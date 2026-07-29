import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { action } = await request.json();

    let updateData = {};
    if (action === 'view') {
      updateData = { views: { increment: 1 } };
    } else if (action === 'like') {
      updateData = { likes: { increment: 1 } };
    } else if (action === 'unlike') {
      updateData = { likes: { decrement: 1 } };
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const updatedBlog = await prisma.article.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(updatedBlog);
  } catch (error) {
    console.error('Error updating metrics:', error);
    return NextResponse.json({ error: 'Failed to update metrics' }, { status: 500 });
  }
}
