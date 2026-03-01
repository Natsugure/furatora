import { notFound } from 'next/navigation';
import { db } from '@furatora/database/client';
import { operators } from '@furatora/database/schema';
import { eq } from 'drizzle-orm';
import { Title, Text } from '@mantine/core';
import { OperatorForm } from '@/components/OperatorForm';

export default async function OperatorEditPage({
  params,
}: {
  params: Promise<{ operatorId: string }>;
}) {
  const { operatorId } = await params;
  const [operator] = await db.select().from(operators).where(eq(operators.id, operatorId));

  if (!operator) {
    notFound();
  }

  return (
    <div>
      <Title order={2} mb="xs">事業者を編集</Title>
      <Text size="sm" c="dimmed" mb="lg">{operator.name}</Text>
      <OperatorForm
        operatorId={operator.id}
        initialData={{
          name: operator.name,
          odptOperatorId: operator.odptOperatorId,
          displayPriority: operator.displayPriority,
        }}
      />
    </div>
  );
}
