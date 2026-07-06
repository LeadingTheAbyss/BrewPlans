import { NextResponse } from 'next/server';

const PYTHON_API_URL = 'http://127.0.0.1:8002/api';

export async function GET(
  req: Request,
  { params }: { params: { pincode: string } }
) {
  try {
    const pincode = params.pincode;
    const response = await fetch(`${PYTHON_API_URL}/pincode/${pincode}`);
    if (!response.ok) {
      throw new Error(`Python API responded with status ${response.status}`);
    }
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Pincode proxy error:', error);
    return NextResponse.json({ error: 'Failed to fetch pincode' }, { status: 500 });
  }
}
