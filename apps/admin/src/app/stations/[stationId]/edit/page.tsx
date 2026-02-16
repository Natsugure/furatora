import { notFound } from 'next/navigation';
import { db } from '@stroller-transit-app/database/client';
import { stations } from '@stroller-transit-app/database/schema';
import { eq } from 'drizzle-orm';
import { StationNotesForm } from '@/components/StationNotesForm';

type Props = {
  params: Promise<{ stationId: string }>;
};

export default async function StationEditPage({ params }: Props) {
  const { stationId } = await params;
  const [station] = await db.select().from(stations).where(eq(stations.id, stationId));
  if (!station) {
    notFound();
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-2">{station.name} — 編集</h2>
      {station.nameEn && (
        <p className="text-sm text-gray-500 mb-6">{station.nameEn}</p>
      )}
      <StationNotesForm stationId={station.id} initialNotes={station.notes ?? ''} />
    </div>
  );
}
