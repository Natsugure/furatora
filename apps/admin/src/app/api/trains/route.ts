import { NextResponse } from 'next/server';
import { db } from '@railease-navi/database/client';
import { trains, trainEquipments } from '@railease-navi/database/schema';
import { asc } from 'drizzle-orm';
import type { FreeSpace, PrioritySeat } from '@railease-navi/database/schema';

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
    })
    .returning();

  const equipmentRows = [
    ...(body.freeSpaces ?? []).map((fs: FreeSpace) => ({
      trainId: created.id,
      type: 'free_space' as const,
      carNumber: fs.carNumber,
      nearDoor: fs.nearDoor,
      isStandard: fs.isStandard,
    })),
    ...(body.prioritySeats ?? []).map((ps: PrioritySeat) => ({
      trainId: created.id,
      type: 'priority_seat' as const,
      carNumber: ps.carNumber,
      nearDoor: ps.nearDoor,
      isStandard: ps.isStandard,
    })),
  ];

  if (equipmentRows.length > 0) {
    await db.insert(trainEquipments).values(equipmentRows);
  }

  return NextResponse.json(created, { status: 201 });
}
