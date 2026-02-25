import { notFound } from 'next/navigation';
import { db } from '@furatora/database/client';
import { lines } from '@furatora/database/schema';
import { eq } from 'drizzle-orm';
import { LineForm } from '@/components/LineForm';

export default async function LineEditPage({
  params,
}: {
  params: Promise<{ lineId: string }>;
}) {
  const { lineId } = await params;
  const result = await db.select().from(lines).where(eq(lines.id, lineId)).limit(1);
  const line = result[0];

  if (!line) {
    notFound();
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-2">Edit Line</h2>
      <p className="text-gray-600 mb-6">{line.name}</p>
      <LineForm lineId={lineId} initialData={{ nameKana: line.nameKana }} />
    </div>
  );
}
