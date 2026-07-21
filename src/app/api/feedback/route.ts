import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { content, type, userId } = body;

    if (!content) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    const feedback = await prisma.feedback.create({
      data: {
        content,
        type: type || 'GENERAL',
        userId: userId || null,
      },
    });

    return NextResponse.json({ success: true, feedback }, { status: 201 });
  } catch (error: any) {
    console.error('Feedback submission error:', error);
    return NextResponse.json({ error: 'Failed to submit feedback' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    // In a real app, you would check admin authorization here.
    // For now, we'll return the feedback sorted by newest first.
    const feedbacks = await prisma.feedback.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { name: true, email: true },
        },
      },
    });

    return NextResponse.json({ success: true, feedbacks }, { status: 200 });
  } catch (error: any) {
    console.error('Error fetching feedbacks:', error);
    return NextResponse.json({ error: 'Failed to fetch feedbacks' }, { status: 500 });
  }
}
