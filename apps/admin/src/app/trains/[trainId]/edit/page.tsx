import { notFound } from 'next/navigation';
import { db } from '@stroller-transit-app/database/client';
import { trains } from '@stroller-transit-app/database/schema';
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
          carStructure: train.carStructure,
          freeSpaces: train.freeSpaces,
          prioritySeats: train.prioritySeats,
        }}
      />
    </div>
  );
}
