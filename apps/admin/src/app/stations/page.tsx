import { db } from '@furatora/database/client';
import {
  operators,
  lines,
  stationLines,
  stations,
} from '@furatora/database/schema';
import { asc, eq } from 'drizzle-orm';
import { LinkAnchor } from '@/components/LinkElements';
import { Group, ScrollArea, Stack, Table, TableTbody, TableTd, TableTh, TableThead, TableTr, Text, Title } from '@mantine/core';

export default async function StationsPage() {
  const operatorList = await db.select().from(operators).orderBy(asc(operators.name));
  const lineList = await db.select().from(lines).orderBy(asc(lines.displayOrder));

  const lineStations = await Promise.all(
    lineList.map(async (line) => {
      const stns = await db
        .select({
          id: stations.id,
          name: stations.name,
          nameEn: stations.nameEn,
          code: stations.code,
          stationOrder: stationLines.stationOrder,
        })
        .from(stationLines)
        .innerJoin(stations, eq(stationLines.stationId, stations.id))
        .where(eq(stationLines.lineId, line.id))
        .orderBy(asc(stationLines.stationOrder));

      return { line, stations: stns };
    })
  );

  const byOperator = operatorList.map((op) => ({
    operator: op,
    lines: lineStations.filter((ls) => ls.line.operatorId === op.id),
  }));

  return (
    <div>
      <Title order={2} mb="lg">駅</Title>

      <Stack gap="xl">
        {byOperator.map(({ operator, lines: opLines }) => (
          <div key={operator.id}>
            <Title order={3} mb="sm">{operator.name}</Title>
            <Stack gap="md" ml="md">
              {opLines.map(({ line, stations: stns }) => (
                <div key={line.id}>
                  <Group gap="xs" mb="xs">
                    {line.color && (
                      <span
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          backgroundColor: line.color,
                          display: 'inline-block',
                        }}
                      />
                    )}
                    <Text fw={500}>{line.name}</Text>
                    <Text size="sm" c="dimmed">({stns.length}駅)</Text>
                  </Group>
                  <ScrollArea ml="md">
                    <Table striped highlightOnHover withTableBorder fz="sm">
                      <TableThead>
                        <TableTr>
                          <TableTh>#</TableTh>
                          <TableTh>コード</TableTh>
                          <TableTh>名称</TableTh>
                          <TableTh>名称（英語）</TableTh>
                          <TableTh>設備</TableTh>
                          <TableTh>編集</TableTh>
                        </TableTr>
                      </TableThead>
                      <TableTbody>
                        {stns.map((stn) => (
                          <TableTr key={stn.id}>
                            <TableTd>
                              <Text c="dimmed">{stn.stationOrder}</Text>
                            </TableTd>
                            <TableTd>
                              <Text ff="monospace">{stn.code ?? '-'}</Text>
                            </TableTd>
                            <TableTd>{stn.name}</TableTd>
                            <TableTd>
                              <Text c="dimmed">{stn.nameEn ?? '-'}</Text>
                            </TableTd>
                            <TableTd>
                              <LinkAnchor href={`/stations/${stn.id}/facilities`} size="sm">
                                管理
                              </LinkAnchor>
                            </TableTd>
                            <TableTd>
                              <LinkAnchor href={`/stations/${stn.id}/edit`} size="sm" c="dimmed">
                                編集
                              </LinkAnchor>
                            </TableTd>
                          </TableTr>
                        ))}
                      </TableTbody>
                    </Table>
                  </ScrollArea>
                </div>
              ))}
            </Stack>
          </div>
        ))}
      </Stack>
    </div>
  );
}
