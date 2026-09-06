import { NextRequest, NextResponse } from 'next/server';
import { getVisibleLineWithStations } from '@/external/query/lineStationsQuery';
import type { LineStationsApiResponse } from '@/types';

type RouteParams = {
  params: Promise<{ slug: string }>;
};

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { slug } = await params;

  try {
    const data = await getVisibleLineWithStations(slug);

    if (!data) {
      return NextResponse.json(
        { error: 'Line not found' },
        { status: 404 }
      );
    }

    const response: LineStationsApiResponse = data;

    return NextResponse.json(response);
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
