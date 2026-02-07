import { NextResponse } from 'next/server';
import { db } from '@stroller-transit-app/database/client';
import { lines } from '@stroller-transit-app/database/schema';
import { asc } from 'drizzle-orm';

export async function GET() {
  const result = await db.select().from(lines).orderBy(asc(lines.displayOrder));
  return NextResponse.json(result);
}
