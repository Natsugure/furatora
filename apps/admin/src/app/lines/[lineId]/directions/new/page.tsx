import { notFound } from 'next/navigation';
import { Title } from '@mantine/core';
import { LineDirectionForm } from '@/components/LineDirectionForm';
import { lineDirectionEditPageQuery } from '@/di';
import { parseUuidParams } from '@/shared/list/params';

export default async function NewDirectionPage({
  params,
}: {
  params: Promise<{ lineId: string }>;
}) {
  const ids = parseUuidParams(await params);
  if (!ids) notFound();
  const { lineId } = ids;
  const context = await lineDirectionEditPageQuery.getCreateContext(lineId);

  if (!context) notFound();

  return (
    <div>
      <Title order={2} mb="lg">新規方面 - {context.lineName}</Title>
      <LineDirectionForm lineId={lineId} currentDefaults={context.currentDefaults} />
    </div>
  );
}
