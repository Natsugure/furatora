import { notFound } from 'next/navigation';
import { db } from '@railease-navi/database/client';
import { stations, stationConnections, lines } from '@railease-navi/database/schema';
import { eq, inArray } from 'drizzle-orm';
import { StationNotesForm } from '@/components/StationNotesForm';
import { ConnectionsEditSection, type ConnectionRow } from '@/components/ConnectionsEditSection';

type Props = {
  params: Promise<{ stationId: string }>;
};

export default async function StationEditPage({ params }: Props) {
  const { stationId } = await params;
  const [station] = await db.select().from(stations).where(eq(stations.id, stationId));
  if (!station) {
    notFound();
  }

  // この駅が持つ乗り換え接続を取得（接続先の駅名・路線名も結合）
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

  // 接続先の駅名・路線名を別途解決
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
    <div className="max-w-3xl">
      <h2 className="text-xl font-bold mb-2">{station.name} — 編集</h2>
      {station.nameEn && (
        <p className="text-sm text-gray-500 mb-6">{station.nameEn}</p>
      )}

      <section className="mb-10">
        <h3 className="text-base font-semibold mb-3">駅備考</h3>
        <StationNotesForm stationId={station.id} initialNotes={station.notes ?? ''} />
      </section>

      <section>
        <h3 className="text-base font-semibold mb-3">
          乗り換え接続 ({connections.length}件)
        </h3>
        <ConnectionsEditSection connections={connections} />
      </section>
    </div>
  );
}
