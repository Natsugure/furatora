import { notFound } from 'next/navigation';
import { db } from '@furatora/database/client';
import { lines, lineDirections } from '@furatora/database/schema';
import { eq, and } from 'drizzle-orm';
import { LineDirectionForm } from '@/components/LineDirectionForm';

export default async function EditDirectionPage({
  params,
}: {
  params: Promise<{ lineId: string; directionId: string }>;
}) {
  const { lineId, directionId } = await params;

  const [line] = await db.select().from(lines).where(eq(lines.id, lineId));
  if (!line) notFound();

  const [direction] = await db
    .select()
    .from(lineDirections)
    .where(and(eq(lineDirections.id, directionId), eq(lineDirections.lineId, lineId)));

  if (!direction) notFound();

  return (
    <div>
      <h2 className="text-xl font-bold mb-6">Edit Direction - {line.name}</h2>
      <LineDirectionForm
        lineId={lineId}
        isEdit
        initialData={{
          id: direction.id,
          directionType: direction.directionType,
          representativeStationId: direction.representativeStationId,
          displayName: direction.displayName,
          displayNameEn: direction.displayNameEn ?? '',
          terminalStationIds: direction.terminalStationIds,
          notes: direction.notes ?? '',
        }}
      />
    </div>
  );
}
