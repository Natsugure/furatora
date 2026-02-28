import { notFound } from 'next/navigation';
import { db } from '@furatora/database/client';
import { lines } from '@furatora/database/schema';
import { eq } from 'drizzle-orm';
import { Title, Text } from '@mantine/core';
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
      <Title order={2} mb="xs">路線を編集</Title>
      <Text size="sm" c="dimmed" mb="lg">{line.name}</Text>
      <LineForm lineId={lineId} initialData={{ nameKana: line.nameKana }} />
    </div>
  );
}
