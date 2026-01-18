import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { stations } from '@/db/schema';
import { ilike } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');

  if (!query) {
    return NextResponse.json(
      { error: 'Query parameter "q" is required' },
      { status: 400 }
    );
  }

  try {
    const results = await db
      .select()
      .from(stations)
      .where(ilike(stations.name, `%${query}%`))
      .limit(20);

    return NextResponse.json({
      stations: results,
      total: results.length,
    });
  } catch (error) {
    console.error('Station search error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}