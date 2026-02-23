import { NextResponse } from 'next/server';
import { db } from '@furatora/database/client';
import { facilityTypes } from '@furatora/database/schema';

export async function GET() {
  try {
    const types = await db.select().from(facilityTypes);
    return NextResponse.json(types);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
