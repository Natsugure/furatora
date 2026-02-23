import { NextResponse } from 'next/server';
import { db } from '@furatora/database/client';
import { trains, trainEquipments } from '@furatora/database/schema';
import { eq } from 'drizzle-orm';
import { trainSchema } from '@/lib/validations';

function shapeTrainWithEquipments(
  train: typeof trains.$inferSelect,
  equipments: (typeof trainEquipments.$inferSelect)[]
) {
  return {
    ...train,
    freeSpaces: equipments
      .filter((e) => e.type === 'free_space')
      .map((e) => ({ carNumber: e.carNumber, nearDoor: e.nearDoor, isStandard: e.isStandard })),
    prioritySeats: equipments
      .filter((e) => e.type === 'priority_seat')
      .map((e) => ({ carNumber: e.carNumber, nearDoor: e.nearDoor, isStandard: e.isStandard })),
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ trainId: string }> }
) {
  try {
    const { trainId } = await params;
    const [train] = await db.select().from(trains).where(eq(trains.id, trainId));
    if (!train) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const equipments = await db.select().from(trainEquipments).where(eq(trainEquipments.trainId, trainId));
    return NextResponse.json(shapeTrainWithEquipments(train, equipments));
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ trainId: string }> }
) {
  try {
    const { trainId } = await params;
    const body = await request.json();
    const parsed = trainSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }
    const { name, operatorId, lineIds, carCount, carStructure, limitedToPlatformIds, freeSpaces, prioritySeats } = parsed.data;

    const [updated] = await db
      .update(trains)
      .set({
        name,
        operators: operatorId,
        lines: lineIds,
        carCount,
        carStructure: carStructure ?? null,
        limitedToPlatformIds: limitedToPlatformIds?.length ? limitedToPlatformIds : null,
      })
      .where(eq(trains.id, trainId))
      .returning();
    if (!updated) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await db.delete(trainEquipments).where(eq(trainEquipments.trainId, trainId));

    const equipmentRows = [
      ...(freeSpaces ?? []).map((fs) => ({
        trainId,
        type: 'free_space' as const,
        carNumber: fs.carNumber,
        nearDoor: fs.nearDoor,
        isStandard: fs.isStandard,
      })),
      ...(prioritySeats ?? []).map((ps) => ({
        trainId,
        type: 'priority_seat' as const,
        carNumber: ps.carNumber,
        nearDoor: ps.nearDoor,
        isStandard: ps.isStandard,
      })),
    ];

    if (equipmentRows.length > 0) {
      await db.insert(trainEquipments).values(equipmentRows);
    }

    const equipments = await db.select().from(trainEquipments).where(eq(trainEquipments.trainId, trainId));
    return NextResponse.json(shapeTrainWithEquipments(updated, equipments));
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ trainId: string }> }
) {
  try {
    const { trainId } = await params;
    const [deleted] = await db
      .delete(trains)
      .where(eq(trains.id, trainId))
      .returning();
    if (!deleted) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
