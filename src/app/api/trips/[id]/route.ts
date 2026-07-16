import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';
import { trackApiCall } from '@/lib/metrics';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {

    const { id } = await params;

    const trip = await prisma.tripHistory.findUnique({
      where: { id }
    });

    if (!trip) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    await trackApiCall('/api/trips/[id] (GET)');
    return NextResponse.json({ trip });
  } catch (error) {
    console.error('Fetch trip error:', error);
    return NextResponse.json({ error: 'Failed to fetch trip' }, { status: 500 });
  }
}
