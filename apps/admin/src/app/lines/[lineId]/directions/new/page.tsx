import { notFound } from 'next/navigation';
import { db } from '@furatora/database/client';
import { lines } from '@furatora/database/schema';
import { eq } from 'drizzle-orm';
import { Title } from '@mantine/core';
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
      <Title order={2} mb="lg">新規方面 - {line.name}</Title>
      <LineDirectionForm lineId={lineId} />
    </div>
  );
}
