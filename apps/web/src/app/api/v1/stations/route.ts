import { NextRequest, NextResponse } from 'next/server';
import { searchVisibleStations } from '@/external/query/stationSearchQuery';

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
    const stationGroups = await searchVisibleStations(query);

    return NextResponse.json({
      stationGroups,
      total: stationGroups.length,
    });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
