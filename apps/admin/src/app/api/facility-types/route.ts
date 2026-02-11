import { NextResponse } from 'next/server';
import { db } from '@stroller-transit-app/database/client';
import { facilityTypes } from '@stroller-transit-app/database/schema';

export async function GET() {
  const types = await db.select().from(facilityTypes);
  return NextResponse.json(types);
}
