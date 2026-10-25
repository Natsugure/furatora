import { notFound } from 'next/navigation';
import { Title, Text } from '@mantine/core';
import { LineForm } from '@/components/LineForm';
import { lineEditPageQuery } from '@/di';
import { parseUuidParams } from '@/shared/list/params';

export default async function LineEditPage({
  params,
}: {
  params: Promise<{ lineId: string }>;
}) {
  const ids = parseUuidParams(await params);
  if (!ids) notFound();
  const { lineId } = ids;
  const context = await lineEditPageQuery.getEditContext(lineId);

  if (!context) {
    notFound();
  }

  return (
    <div>
      <Title order={2} mb="xs">路線を編集</Title>
      <Text size="sm" c="dimmed" mb="lg">{context.line.name}</Text>
      <LineForm lineId={lineId} initialData={context.line} operators={context.operators} />
    </div>
  );
}
