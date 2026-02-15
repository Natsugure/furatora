import { notFound } from 'next/navigation';
import { db } from '@stroller-transit-app/database/client';
import {
  stations,
  stationLines,
  platforms,
  lines,
  lineDirections,
  trains,
  stationFacilities,
  facilityTypes,
} from '@stroller-transit-app/database/schema';
import { eq, inArray, sql } from 'drizzle-orm';
import { PlatformDisplay } from '@/components/PlatformDisplay';
import { PlatformTabs, type DirectionTab, type PlatformEntry } from '@/components/PlatformTabs';
import { BackButton } from '@/components/BackButton';
import { StationBadge } from '../../../components/ui/StationBadge';

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
      .where(eq(stationLines.stationId, station.id))

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
    return { station, line: line[0], platforms: [], lines: [], directions: [], trains: [], facilities: [], facilityTypeMap: {} };
  }

  const platformIds = platformList.map((p) => p.id);
  const lineIds = [...new Set(platformList.map((p) => p.lineId))];

  // 路線・方向・設備タイプを並行取得
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

  // 列車情報を取得（trains.lines は uuid[] 型なので && 演算子でオーバーラップ確認）
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

  const facilityList = await db
    .select()
    .from(stationFacilities)
    .where(inArray(stationFacilities.platformId, platformIds));

  const facilityTypeMap = Object.fromEntries(
    facilityTypeList.map((t) => [t.code, t.name])
  );

  return {
    station,
    platforms: platformList,
    line: line[0],
    lines: lineList,
    directions: directionList,
    trains: trainList,
    facilities: facilityList,
    facilityTypeMap,
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
    line: line,
    lines: lineList,
    directions,
    trains: trainList,
    facilities,
    facilityTypeMap,
  } = data;

  const lineMap = Object.fromEntries(lineList.map((l) => [l.id, l]));
  const directionMap = Object.fromEntries(directions.map((d) => [d.id, d]));

  // プラットフォームごとの表示データを構築
  const buildPlatformEntry = (platform: (typeof platformList)[number]): PlatformEntry => {
    const line = lineMap[platform.lineId];
    const inboundDirection = platform.inboundDirectionId
      ? directionMap[platform.inboundDirectionId] ?? null
      : null;
    const outboundDirection = platform.outboundDirectionId
      ? directionMap[platform.outboundDirectionId] ?? null
      : null;

    const platformTrains = trainList.filter((train) =>
      train.lines?.includes(platform.lineId)
    );

    const platformFacilities = facilities
      .filter((f) => f.platformId === platform.id)
      .map((f) => ({
        ...f,
        typeName: facilityTypeMap[f.typeCode] ?? f.typeCode,
      }));

    return {
      platform,
      line,
      inboundDirection,
      outboundDirection,
      trains: platformTrains,
      facilities: platformFacilities,
    };
  };

  // 方向別タブを構築
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

  // 方向が設定されていないプラットフォーム
  const noDirectionPlatforms = platformList.filter(
    (p) => !p.inboundDirectionId && !p.outboundDirectionId
  );

  // タブ配列を構築
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
    <main className="min-h-screen p-4 md:p-8 max-w-6xl mx-auto">
      {/* Back navigation */}
      <BackButton />

      {/* Station header */}
      <div className="flex gap-2">
        {station.code && (
          <StationBadge code={station.code} color={line.color ?? null} />
        )}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">{station.name}</h1>
          {station.nameEn && (
            <p className="text-xl text-gray-600">{station.nameEn}</p>
          )}
        </div>
      </div>


      {/* Platform list */}
      {platformList.length > 0 ? (
        <div>
          <h2 className="text-2xl font-bold mb-4">のりかえ出口・列車設備案内</h2>
          {tabs.length > 1 ? (
            <PlatformTabs tabs={tabs} />
          ) : (
            <div className="space-y-6">
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
                    facilities={entry.facilities}
                  />
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="text-center text-gray-500 py-12">
          <p>この駅のプラットフォーム情報がありません</p>
        </div>
      )}
    </main>
  );
}
