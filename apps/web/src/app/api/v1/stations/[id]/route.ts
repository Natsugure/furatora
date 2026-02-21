import { NextRequest, NextResponse } from 'next/server';
import { db } from '@railease-navi/database/client';
import { stations } from '@railease-navi/database/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {

    const { id } = await params;

    const result = await db
      .select()
      .from(stations)
      .where(eq(stations.id, id))
      .limit(1);

    if (result.length === 0) {
      return NextResponse.json(
        { error: 'Station not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('Station detail error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}