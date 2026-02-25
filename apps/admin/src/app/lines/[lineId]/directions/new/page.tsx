import { notFound } from 'next/navigation';
import { db } from '@furatora/database/client';
import { lines } from '@furatora/database/schema';
import { eq } from 'drizzle-orm';
import { LineDirectionForm } from '@/components/LineDirectionForm';

export default async function NewDirectionPage({
  params,
}: {
  params: Promise<{ lineId: string }>;
}) {
  const { lineId } = await params;
  const [line] = await db.select().from(lines).where(eq(lines.id, lineId));

  if (!line) notFound();

  return (
    <div>
      <h2 className="text-xl font-bold mb-6">New Direction - {line.name}</h2>
      <LineDirectionForm lineId={lineId} />
    </div>
  );
}
