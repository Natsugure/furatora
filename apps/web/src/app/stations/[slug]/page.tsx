import { notFound } from 'next/navigation';
import { Info } from 'lucide-react';
import { db } from '@stroller-transit-app/database/client';
import {
  stations,
  stationLines,
  platforms,
  lines,
  lineDirections,
  trains,
  platformLocations,
  stationFacilities,
  facilityTypes,
  facilityConnections,
  stationConnections,
} from '@stroller-transit-app/database/schema';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { PlatformDisplay } from '@/components/PlatformDisplay';
import { PlatformTabs, type DirectionTab, type PlatformEntry } from '@/components/PlatformTabs';
import { BackButton } from '@/components/BackButton';
import { StationBadge } from '../../../components/ui/StationBadge';
import { TransferDifficultySection, type TransferConnection } from '@/components/TransferDifficultySection';

type Props = {
  params: Promise<{ slug: string }>;
};

async function fetchStationDetails(slug: string) {
  const stationRecord = await db
    .select()
    .from(stations)
    .where(eq(stations.slug, slug))
    .limit(1);

  if (!stationRecord.length) {
    return null;
  }

  const station = stationRecord[0];

  const line = await db
    .select({
      lineId: stationLines.lineId,
      lineCode: lines.lineCode,
      color: lines.color,
    })
    .from(stationLines)
    .innerJoin(lines, eq(stationLines.lineId, lines.id))
    .where(eq(stationLines.stationId, station.id));

  const platformList = await db
    .select({
      id: platforms.id,
      platformNumber: platforms.platformNumber,
      lineId: platforms.lineId,
      inboundDirectionId: platforms.inboundDirectionId,
      outboundDirectionId: platforms.outboundDirectionId,
      maxCarCount: platforms.maxCarCount,
      carStopPositions: platforms.carStopPositions,
      platformSide: platforms.platformSide,
      notes: platforms.notes,
    })
    .from(platforms)
    .where(eq(platforms.stationId, station.id));

  if (!platformList.length) {
    return { station, line: line[0], platforms: [], lines: [], directions: [], trains: [], locations: [], facilityTypeMap: {} as Record<string, string>, connectionsByLocation: {} as Record<string, { stationName: string; lineNames: string[]; exitLabel: string | null }[]>, transferConnections: [] };
  }

  const platformIds = platformList.map((p) => p.id);
  const lineIds = [...new Set(platformList.map((p) => p.lineId))];

  const [lineList, directionList, facilityTypeList] = await Promise.all([
    db.select().from(lines).where(inArray(lines.id, lineIds)),
    (async () => {
      const directionIds = [
        ...new Set(
          platformList
            .flatMap((p) => [p.inboundDirectionId, p.outboundDirectionId])
            .filter((id): id is string => id !== null)
        ),
      ];
      return directionIds.length > 0
        ? db.select().from(lineDirections).where(inArray(lineDirections.id, directionIds))
        : [];
    })(),
    db.select().from(facilityTypes),
  ]);

  const trainList = lineIds.length > 0
    ? await db
        .select()
        .from(trains)
        .where(
          sql`${trains.lines} && ARRAY[${sql.join(
            lineIds.map((id) => sql`${id}::uuid`),
            sql`, `
          )}]::uuid[]`
        )
    : [];

  // platformLocations をプラットフォームIDで取得
  const locationList = await db
    .select()
    .from(platformLocations)
    .where(inArray(platformLocations.platformId, platformIds));

  const facilityTypeMap = Object.fromEntries(
    facilityTypeList.map((t) => [t.code, t.name])
  );

  const locationIds = locationList.map((l) => l.id);

  // 各 location の設備タイプを取得
  const facilityList = locationIds.length > 0
    ? await db
        .select()
        .from(stationFacilities)
        .where(inArray(stationFacilities.platformLocationId, locationIds))
    : [];

  // facilityConnections: 場所に紐づく乗換駅と路線名を取得
  const connectionRows = locationIds.length > 0
    ? await db
        .select({
          platformLocationId: facilityConnections.platformLocationId,
          exitLabel: facilityConnections.exitLabel,
          connectedStationId: facilityConnections.connectedStationId,
          stationName: stations.name,
        })
        .from(facilityConnections)
        .innerJoin(stations, eq(facilityConnections.connectedStationId, stations.id))
        .where(inArray(facilityConnections.platformLocationId, locationIds))
    : [];

  const connectedStationIds = [...new Set(connectionRows.map((r) => r.connectedStationId))];
  const stationLineNames = connectedStationIds.length > 0
    ? await db
        .select({ stationId: stationConnections.connectedStationId, lineName: lines.name })
        .from(stationConnections)
        .innerJoin(lines, eq(stationConnections.connectedRailwayId, lines.id))
        .where(
          and(
            eq(stationConnections.stationId, station.id),
            inArray(stationConnections.connectedStationId, connectedStationIds)
          )
        )
    : [];

  const linesByStation: Record<string, string[]> = {};
  for (const row of stationLineNames) {
    if (!row.stationId) continue;
    if (!linesByStation[row.stationId]) linesByStation[row.stationId] = [];
    linesByStation[row.stationId].push(row.lineName);
  }

  const connectionsByLocation: Record<string, { stationName: string; lineNames: string[]; exitLabel: string | null }[]> = {};
  for (const row of connectionRows) {
    if (!connectionsByLocation[row.platformLocationId]) connectionsByLocation[row.platformLocationId] = [];
    connectionsByLocation[row.platformLocationId].push({
      stationName: row.stationName,
      lineNames: linesByStation[row.connectedStationId] ?? [],
      exitLabel: row.exitLabel,
    });
  }

  // 乗換難易度: stationConnections から難易度が設定済みのものを取得
  const transferConnectionRows = await db
    .select({
      lineName: lines.name,
      lineColor: lines.color,
      strollerDifficulty: stationConnections.strollerDifficulty,
      wheelchairDifficulty: stationConnections.wheelchairDifficulty,
      notesAboutStroller: stationConnections.notesAboutStroller,
      notesAboutWheelchair: stationConnections.notesAboutWheelchair,
    })
    .from(stationConnections)
    .innerJoin(lines, eq(stationConnections.connectedRailwayId, lines.id))
    .where(eq(stationConnections.stationId, station.id));

  const transferConnections: TransferConnection[] = transferConnectionRows.filter(
    (r) => r.strollerDifficulty !== null || r.wheelchairDifficulty !== null
  );

  return {
    station,
    platforms: platformList,
    line: line[0],
    lines: lineList,
    directions: directionList,
    trains: trainList,
    locations: locationList,
    facilityList,
    facilityTypeMap,
    connectionsByLocation,
    transferConnections,
  };
}

export default async function StationDetailPage({ params }: Props) {
  const { slug } = await params;
  const data = await fetchStationDetails(slug);

  if (!data) {
    notFound();
  }

  const {
    station,
    platforms: platformList,
    line,
    lines: lineList,
    directions,
    trains: trainList,
    locations,
    facilityList,
    facilityTypeMap,
    connectionsByLocation,
    transferConnections,
  } = data;

  const lineMap = Object.fromEntries(lineList.map((l) => [l.id, l]));
  const directionMap = Object.fromEntries(directions.map((d) => [d.id, d]));

  const buildPlatformEntry = (platform: (typeof platformList)[number]): PlatformEntry => {
    const line = lineMap[platform.lineId];
    const inboundDirection = platform.inboundDirectionId
      ? directionMap[platform.inboundDirectionId] ?? null
      : null;
    const outboundDirection = platform.outboundDirectionId
      ? directionMap[platform.outboundDirectionId] ?? null
      : null;

    const platformTrains = trainList.filter((train) => {
      if (!train.lines?.includes(platform.lineId)) return false;
      if (train.carCount > platform.maxCarCount) return false;
      if (train.limitedToPlatformIds && train.limitedToPlatformIds.length > 0) {
        return train.limitedToPlatformIds.includes(platform.id);
      }
      return true;
    });

    const platformLocationsForPlatform = locations
      .filter((loc) => loc.platformId === platform.id)
      .map((loc) => ({
        id: loc.id,
        nearPlatformCell: loc.nearPlatformCell,
        exits: loc.exits,
        facilities: facilityList
          .filter((f) => f.platformLocationId === loc.id)
          .map((f) => ({
            id: f.id,
            typeCode: f.typeCode,
            typeName: facilityTypeMap[f.typeCode] ?? f.typeCode,
            isWheelchairAccessible: f.isWheelchairAccessible,
            isStrollerAccessible: f.isStrollerAccessible,
          })),
        connections: connectionsByLocation[loc.id] ?? [],
      }));

    return {
      platform,
      line,
      inboundDirection,
      outboundDirection,
      trains: platformTrains,
      locations: platformLocationsForPlatform,
    };
  };

  const directionToEntries = new Map<string, PlatformEntry[]>();

  for (const platform of platformList) {
    const entry = buildPlatformEntry(platform);
    const dirIds = [platform.inboundDirectionId, platform.outboundDirectionId].filter(
      (id): id is string => id !== null
    );

    for (const dirId of dirIds) {
      if (!directionToEntries.has(dirId)) {
        directionToEntries.set(dirId, []);
      }
      const existing = directionToEntries.get(dirId)!;
      if (!existing.some((e) => e.platform.id === platform.id)) {
        existing.push(entry);
      }
    }
  }

  const noDirectionPlatforms = platformList.filter(
    (p) => !p.inboundDirectionId && !p.outboundDirectionId
  );

  const tabs: DirectionTab[] = [
    ...[...directionToEntries.entries()].map(([dirId, entries]) => ({
      directionId: dirId,
      directionName: directionMap[dirId]?.displayName ?? '方面',
      platforms: entries,
    })),
    ...(noDirectionPlatforms.length > 0
      ? [
          {
            directionId: null,
            directionName: '全方面',
            platforms: noDirectionPlatforms.map(buildPlatformEntry),
          },
        ]
      : []),
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Back navigation */}
      <BackButton />

      {/* Station header card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-5">
        <div className="flex items-center gap-4">
          {station.code && (
            <StationBadge code={station.code} color={line?.color ?? null} />
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{station.name}</h1>
            {station.nameEn && (
              <p className="text-gray-500 text-sm mt-0.5">{station.nameEn}</p>
            )}
          </div>
        </div>
      </div>

      {/* Notes */}
      {station.notes && (
        <div className="mb-5 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-900 whitespace-pre-wrap">
          {station.notes}
        </div>
      )}

      {/* Transfer difficulty */}
      <TransferDifficultySection connections={transferConnections} />

      {/* Platform list */}
      {platformList.length > 0 ? (
        <div>
          {/* Info alert */}
          <div className="mb-5 bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex gap-2.5">
              <Info size={18} className="text-blue-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-blue-900 mb-1">ご利用案内</p>
                <p className="text-sm text-blue-700">
                  各ホームのバリアフリー設備と列車のフリースペース・優先席の位置を確認できます。
                  エレベーターの位置を参考に、乗車位置を事前に確認することで、スムーズな移動が可能です。
                </p>
              </div>
            </div>
          </div>

          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            ホーム情報
          </h2>
          {tabs.length > 1 ? (
            <PlatformTabs tabs={tabs} />
          ) : (
            <div className="space-y-4">
              {platformList.map((platform) => {
                const entry = buildPlatformEntry(platform);
                return (
                  <PlatformDisplay
                    key={platform.id}
                    platform={entry.platform}
                    line={entry.line}
                    inboundDirection={entry.inboundDirection}
                    outboundDirection={entry.outboundDirection}
                    trains={entry.trains}
                    locations={entry.locations}
                  />
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-10 text-center text-gray-500">
          <p>この駅のプラットフォーム情報がありません</p>
        </div>
      )}
    </div>
  );
}
