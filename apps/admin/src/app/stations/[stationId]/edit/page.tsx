import { notFound } from 'next/navigation';
import { db } from '@furatora/database/client';
import { stations, stationConnections, lines } from '@furatora/database/schema';
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
      odptStationId: stationConnections.odptStationId,
      odptRailwayId: stationConnections.odptRailwayId,
      connectedStationId: stationConnections.connectedStationId,
      connectedRailwayId: stationConnections.connectedRailwayId,
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
  const connectedRailwayIds = connectionRows
    .map((c) => c.connectedRailwayId)
    .filter((id): id is string => id !== null);

  const [connectedStationList, connectedLineList] = await Promise.all([
    connectedStationIds.length > 0
      ? db.select({ id: stations.id, name: stations.name }).from(stations).where(inArray(stations.id, connectedStationIds))
      : Promise.resolve([]),
    connectedRailwayIds.length > 0
      ? db.select({ id: lines.id, name: lines.name }).from(lines).where(inArray(lines.id, connectedRailwayIds))
      : Promise.resolve([]),
  ]);

  const stationNameMap = Object.fromEntries(connectedStationList.map((s) => [s.id, s.name]));
  const lineNameMap = Object.fromEntries(connectedLineList.map((l) => [l.id, l.name]));

  const connections: ConnectionRow[] = connectionRows.map((c) => ({
    id: c.id,
    connectedStationName: c.connectedStationId ? (stationNameMap[c.connectedStationId] ?? null) : null,
    connectedLineName: c.connectedRailwayId ? (lineNameMap[c.connectedRailwayId] ?? null) : null,
    odptStationId: c.odptStationId,
    odptRailwayId: c.odptRailwayId,
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
        initialNameKana={station.nameKana}
        initialNotes={station.notes}
        connections={connections}
      />
    </div>
  );
}
