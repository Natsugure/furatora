import { notFound } from 'next/navigation';
import { db } from '@stroller-transit-app/database/client';
import { trains, trainEquipments } from '@stroller-transit-app/database/schema';
import { eq } from 'drizzle-orm';
import { TrainForm } from '@/components/TrainForm';

export default async function EditTrainPage({
  params,
}: {
  params: Promise<{ trainId: string }>;
}) {
  const { trainId } = await params;
  const [train] = await db.select().from(trains).where(eq(trains.id, trainId));

  if (!train) notFound();

  const equipments = await db.select().from(trainEquipments).where(eq(trainEquipments.trainId, trainId));

  return (
    <div>
      <h2 className="text-xl font-bold mb-6">Edit Train</h2>
      <TrainForm
        isEdit
        initialData={{
          id: train.id,
          name: train.name,
          operatorId: train.operators,
          lineIds: train.lines,
          carCount: train.carCount,
          carStructure: train.carStructure ?? null,
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
