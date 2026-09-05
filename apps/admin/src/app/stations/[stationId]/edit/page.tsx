import { notFound } from 'next/navigation';
import { db } from '@furatora/database/client';
import { stations, stationConnections, stationLines, lines } from '@furatora/database/schema';
import { eq, inArray } from 'drizzle-orm';
import { Title, Text } from '@mantine/core';
import { StationEditForm, type ConnectionRow } from '@/components/StationEditForm';

type Props = {
  params: Promise<{ stationId: string }>;
};

export default async function StationEditPage({ params }: Props) {
  const { stationId } = await params;
  const [station] = await db.select().from(stations).where(eq(stations.id, stationId));
  if (!station) {
    notFound();
  }

  const connectionRows = await db
    .select({
      id: stationConnections.id,
      connectedStationId: stationConnections.connectedStationId,
      strollerDifficulty: stationConnections.strollerDifficulty,
      wheelchairDifficulty: stationConnections.wheelchairDifficulty,
      notesAboutStroller: stationConnections.notesAboutStroller,
      notesAboutWheelchair: stationConnections.notesAboutWheelchair,
    })
    .from(stationConnections)
    .where(eq(stationConnections.stationId, stationId));

  const connectedStationIds = connectionRows
    .map((c) => c.connectedStationId)
    .filter((id): id is string => id !== null);

  // connectedRailwayId は TASK-4.2 で削除された（ODPT 同期専用の列）。
  // 路線名は stationLines 経由で解決する（駅が決まればほぼ1路線に定まる）
  const [connectedStationList, connectedLineRows] = await Promise.all([
    connectedStationIds.length > 0
      ? db.select({ id: stations.id, name: stations.name }).from(stations).where(inArray(stations.id, connectedStationIds))
      : Promise.resolve([]),
    connectedStationIds.length > 0
      ? db
          .select({ stationId: stationLines.stationId, lineName: lines.name })
          .from(stationLines)
          .innerJoin(lines, eq(lines.id, stationLines.lineId))
          .where(inArray(stationLines.stationId, connectedStationIds))
      : Promise.resolve([]),
  ]);

  const stationNameMap = Object.fromEntries(connectedStationList.map((s) => [s.id, s.name]));
  const lineNameByStationIdMap = new Map<string, string>();
  for (const row of connectedLineRows) {
    if (!lineNameByStationIdMap.has(row.stationId)) {
      lineNameByStationIdMap.set(row.stationId, row.lineName);
    }
  }

  const connections: ConnectionRow[] = connectionRows.map((c) => ({
    id: c.id,
    connectedStationName: c.connectedStationId ? (stationNameMap[c.connectedStationId] ?? null) : null,
    connectedLineName: c.connectedStationId ? (lineNameByStationIdMap.get(c.connectedStationId) ?? null) : null,
    strollerDifficulty: c.strollerDifficulty,
    wheelchairDifficulty: c.wheelchairDifficulty,
    notesAboutStroller: c.notesAboutStroller,
    notesAboutWheelchair: c.notesAboutWheelchair,
  }));

  return (
    <div>
      <Title order={2} mb="xs">{station.name} — 編集</Title>
      {station.nameEn && (
        <Text size="sm" c="dimmed" mb="lg">{station.nameEn}</Text>
      )}

      <StationEditForm
        stationId={station.id}
        initialData={{
          name: station.name,
          nameKana: station.nameKana,
          nameEn: station.nameEn,
          odptStationId: station.odptStationId,
          slug: station.slug,
          code: station.code,
          lat: station.lat,
          lon: station.lon,
          operatorId: station.operatorId,
          notes: station.notes,
        }}
        connections={connections}
      />
    </div>
  );
}
