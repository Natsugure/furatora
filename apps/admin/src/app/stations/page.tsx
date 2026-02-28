import { db } from '@furatora/database/client';
import {
  operators,
  lines,
  stationLines,
  stations,
} from '@furatora/database/schema';
import { asc, eq } from 'drizzle-orm';
import { LinkAnchor } from '@/components/LinkElements';
import { Group, Stack, Table, TableTbody, TableTd, TableTh, TableThead, TableTr, Text, Title } from '@mantine/core';

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
      <Title order={2} mb="lg">Stations</Title>

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
                    <Text size="sm" c="dimmed">({stns.length} stations)</Text>
                  </Group>
                  <Table striped highlightOnHover withTableBorder ml="md" fz="sm">
                    <TableThead>
                      <TableTr>
                        <TableTh>#</TableTh>
                        <TableTh>Code</TableTh>
                        <TableTh>Name</TableTh>
                        <TableTh>Name (EN)</TableTh>
                        <TableTh>Facilities</TableTh>
                        <TableTh>Edit</TableTh>
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
                              Manage
                            </LinkAnchor>
                          </TableTd>
                          <TableTd>
                            <LinkAnchor href={`/stations/${stn.id}/edit`} size="sm" c="dimmed">
                              Edit
                            </LinkAnchor>
                          </TableTd>
                        </TableTr>
                      ))}
                    </TableTbody>
                  </Table>
                </div>
              ))}
            </Stack>
          </div>
        ))}
      </Stack>
    </div>
  );
}
