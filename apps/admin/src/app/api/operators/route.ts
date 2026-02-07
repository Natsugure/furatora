import { NextResponse } from 'next/server';
import { db } from '@stroller-transit-app/database/client';
import { operators } from '@stroller-transit-app/database/schema';
import { asc } from 'drizzle-orm';

export async function GET() {
  const result = await db.select().from(operators).orderBy(asc(operators.name));
  return NextResponse.json(result);
}
