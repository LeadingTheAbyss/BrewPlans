import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, destination, stepReached, timeToComplete } = body;
    
    if (stepReached === 'STARTED') {
      const attempt = await prisma.tripAttempt.create({
        data: {
          userId: userId || null,
          destination,
          stepReached,
          abandoned: true // Assume abandoned until finalized
        }
      });
      return NextResponse.json({ success: true, attemptId: attempt.id }, { status: 200 });
    } else if (body.attemptId) {
      // Update an existing attempt
      const attempt = await prisma.tripAttempt.update({
        where: { id: body.attemptId },
        data: {
          stepReached,
          destination: destination || undefined,
          abandoned: stepReached !== 'FINALIZED',
          timeToComplete: timeToComplete || undefined
        }
      });
      return NextResponse.json({ success: true, attemptId: attempt.id }, { status: 200 });
    }

    return NextResponse.json({ success: false, error: 'Invalid payload' }, { status: 400 });
  } catch (error: any) {
    console.error('Trip Attempt Error:', error);
    return NextResponse.json({ error: 'Failed to log trip attempt' }, { status: 500 });
  }
}
