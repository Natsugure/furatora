import { notFound } from 'next/navigation';
import { Title } from '@mantine/core';
import { LineDirectionForm } from '@/components/LineDirectionForm';
import { lineDirectionEditPageQuery } from '@/di';
import { parseUuidParams } from '@/shared/list/params';

export default async function EditDirectionPage({
  params,
}: {
  params: Promise<{ lineId: string; directionId: string }>;
}) {
  const ids = parseUuidParams(await params);
  if (!ids) notFound();
  const { lineId, directionId } = ids;
  const context = await lineDirectionEditPageQuery.getEditContext(lineId, directionId);

  if (!context?.direction) notFound();

  return (
    <div>
      <Title order={2} mb="lg">方面を編集 - {context.lineName}</Title>
      <LineDirectionForm
        lineId={lineId}
        isEdit
        initialData={context.direction}
        currentDefaults={context.currentDefaults}
      />
    </div>
  );
}
