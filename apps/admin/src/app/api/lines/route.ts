import { NextResponse } from 'next/server';
import { db } from '@railease-navi/database/client';
import { lines } from '@railease-navi/database/schema';
import { asc } from 'drizzle-orm';

export async function GET() {
  try {
    const result = await db.select().from(lines).orderBy(asc(lines.displayOrder));
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
