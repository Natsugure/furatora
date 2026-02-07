import { NextResponse } from 'next/server';
import { db } from '@stroller-transit-app/database/client';
import { trains } from '@stroller-transit-app/database/schema';
import { asc } from 'drizzle-orm';

export async function GET() {
  const result = await db.select().from(trains).orderBy(asc(trains.name));
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const body = await request.json();
  const [created] = await db
    .insert(trains)
    .values({
      name: body.name,
      operators: body.operatorId,
      lines: body.lineIds,
      carCount: body.carCount,
      carStructure: body.carStructure || null,
      freeSpaces: body.freeSpaces || null,
      prioritySeats: body.prioritySeats || null,
    })
    .returning();
  return NextResponse.json(created, { status: 201 });
}
