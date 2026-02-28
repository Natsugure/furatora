import { notFound } from 'next/navigation';
import { db } from '@furatora/database/client';
import { lines, lineDirections, stations } from '@furatora/database/schema';
import { eq, asc, inArray } from 'drizzle-orm';
import { Card, Group, Stack, Text, Title } from '@mantine/core';
import { DeleteButton } from '@/components/DeleteButton';
import { LinkAnchor, LinkButton } from '@/components/LinkElements';

export default async function LineDirectionsPage({
  params,
}: {
  params: Promise<{ lineId: string }>;
}) {
  const { lineId } = await params;
  const [line] = await db.select().from(lines).where(eq(lines.id, lineId));

  if (!line) notFound();

  const directions = await db
    .select()
    .from(lineDirections)
    .where(eq(lineDirections.lineId, lineId))
    .orderBy(asc(lineDirections.directionType));

  // Fetch representative stations
  const stationIds = directions.map((d) => d.representativeStationId);
  const stationList =
    stationIds.length > 0
      ? await db.select().from(stations).where(inArray(stations.id, stationIds))
      : [];
  const stationMap = Object.fromEntries(stationList.map((s) => [s.id, s.name]));

  return (
    <div>
      <LinkAnchor href="/lines" size="sm" mb="lg" style={{ display: 'block' }}>
        &larr; 路線一覧に戻る
      </LinkAnchor>

      <Group justify="space-between" mb="lg">
        <div>
          <Title order={2}>{line.name}</Title>
          <Text size="sm" c="dimmed">方面を管理</Text>
        </div>
        <LinkButton href={`/lines/${lineId}/directions/new`}>
          + 新規方面
        </LinkButton>
      </Group>

      <Text size="sm" c="dimmed" mb="md">
        この路線の方面情報を設定します。ホームを登録する際に使用されます。
      </Text>

      {directions.length === 0 ? (
        <Text size="sm" c="dimmed">
          方面がまだ定義されていません。「+ 新規方面」をクリックして作成してください。
        </Text>
      ) : (
        <Stack gap="sm">
          {directions.map((direction) => (
            <Card key={direction.id} withBorder padding="md">
              <Group justify="space-between" align="flex-start">
                <div>
                  <Group gap="xs" mb={4}>
                    <Text fw={500} size="lg">{direction.displayName}</Text>
                    {direction.displayNameEn && (
                      <Text size="sm" c="dimmed">({direction.displayNameEn})</Text>
                    )}
                  </Group>
                  <Text size="sm" c="dimmed">
                    タイプ: {direction.directionType === 'inbound' ? '上り' : '下り'}
                  </Text>
                  <Text size="sm" c="dimmed">
                    代表駅: {stationMap[direction.representativeStationId] ?? '-'}
                  </Text>
                  {direction.notes && (
                    <Text size="sm" c="gray.5" mt="xs">{direction.notes}</Text>
                  )}
                </div>
                <Group gap="xs">
                  <LinkButton
                    href={`/lines/${lineId}/directions/${direction.id}/edit`}
                    variant="default"
                    size="compact-sm"
                  >
                    編集
                  </LinkButton>
                  <DeleteButton
                    endpoint={`/api/lines/${lineId}/directions/${direction.id}`}
                    redirectTo={`/lines/${lineId}/directions`}
                  />
                </Group>
              </Group>
            </Card>
          ))}
        </Stack>
      )}
    </div>
  );
}
