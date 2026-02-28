import { notFound } from 'next/navigation';
import { db } from '@furatora/database/client';
import { trains, trainEquipments, trainCarStructures } from '@furatora/database/schema';
import { eq } from 'drizzle-orm';
import { Title } from '@mantine/core';
import { TrainForm } from '@/components/TrainForm';

export default async function EditTrainPage({
  params,
}: {
  params: Promise<{ trainId: string }>;
}) {
  const { trainId } = await params;
  const [train] = await db.select().from(trains).where(eq(trains.id, trainId));

  if (!train) notFound();

  const [equipments, carStructureRows] = await Promise.all([
    db.select().from(trainEquipments).where(eq(trainEquipments.trainId, trainId)),
    db.select().from(trainCarStructures).where(eq(trainCarStructures.trainId, trainId)),
  ]);

  return (
    <div>
      <Title order={2} mb="lg">Edit Train</Title>
      <TrainForm
        isEdit
        initialData={{
          id: train.id,
          name: train.name,
          operatorId: train.operators,
          lineIds: train.lines,
          carCount: train.carCount,
          carStructure: carStructureRows.length > 0
            ? carStructureRows.map((cs) => ({ carNumber: cs.carNumber, doorCount: cs.doorCount }))
            : null,
          freeSpaces: equipments
            .filter((e) => e.type === 'free_space')
            .map((e) => ({ carNumber: e.carNumber, nearDoor: e.nearDoor, isStandard: e.isStandard })),
          prioritySeats: equipments
            .filter((e) => e.type === 'priority_seat')
            .map((e) => ({ carNumber: e.carNumber, nearDoor: e.nearDoor, isStandard: e.isStandard })),
          limitedToPlatformIds: train.limitedToPlatformIds,
        }}
      />
    </div>
  );
}
