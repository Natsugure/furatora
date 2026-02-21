import { NextResponse } from 'next/server';
import { db } from '@railease-navi/database/client';
import { facilityTypes } from '@railease-navi/database/schema';

export async function GET() {
  const types = await db.select().from(facilityTypes);
  return NextResponse.json(types);
}
