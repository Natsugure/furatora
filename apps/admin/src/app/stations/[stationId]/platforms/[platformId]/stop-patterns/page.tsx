import { notFound } from 'next/navigation';
import { Group, Stack, Table, Text, Title } from '@mantine/core';
import { LinkButton } from '@/components/LinkElements';
import { DeleteButton } from '@/components/DeleteButton';
import { stopPatternPageQuery } from '@/di';

export default async function StopPatternsPage({
  params,
}: {
  params: Promise<{ stationId: string; platformId: string }>;
}) {
  const { stationId, platformId } = await params;
  const data = await stopPatternPageQuery.getListByPlatform(stationId, platformId);
  if (!data) notFound();

  const basePath = `/stations/${stationId}/platforms/${platformId}/stop-patterns`;

  return (
    <div>
      <Group justify="space-between" mb="lg">
        <div>
          <Title order={2}>停車位置パターン - {data.stationName} {data.platformNumber}番線</Title>
          <Text size="sm" c="dimmed">ホーム長: {data.physicalLength.toFixed(2)} m</Text>
        </div>
        <LinkButton href={`${basePath}/new`}>+ 新規作成</LinkButton>
      </Group>

      {data.patterns.length === 0 ? (
        <Text size="sm" c="dimmed">
          停車位置パターンがまだ登録されていません。停車位置パターンが未登録の列車は
          Web側のホーム表示に出てきません。
        </Text>
      ) : (
        <Table striped highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>列車</Table.Th>
              <Table.Th>号車範囲</Table.Th>
              <Table.Th>操作</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {data.patterns.map((pattern) => {
              const sortedCars = [...pattern.cars].sort((a, b) => a.carNumber - b.carNumber);
              const first = sortedCars[0];
              const last = sortedCars[sortedCars.length - 1];
              const rangeLabel = first && last
                ? `${first.carNumber}号車〜${last.carNumber}号車 (${Math.min(first.startMeters, last.startMeters).toFixed(2)}〜${Math.max(first.endMeters, last.endMeters).toFixed(2)} m)`
                : '-';
              return (
                <Table.Tr key={pattern.id}>
                  <Table.Td fw={500}>{pattern.trainName}</Table.Td>
                  <Table.Td>{rangeLabel}</Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <LinkButton
                        href={`${basePath}/${pattern.id}/edit`}
                        variant="default"
                        size="compact-xs"
                      >
                        編集
                      </LinkButton>
                      <DeleteButton
                        endpoint={`/api/stations/${stationId}/train-stop-patterns/${pattern.id}`}
                        redirectTo={basePath}
                      />
                    </Group>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      )}

      <Stack mt="xl">
        <LinkButton href={`/stations/${stationId}/facilities`} variant="default" w="fit-content">
          ホーム一覧に戻る
        </LinkButton>
      </Stack>
    </div>
  );
}
