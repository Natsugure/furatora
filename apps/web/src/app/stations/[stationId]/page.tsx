import { notFound } from 'next/navigation';
import Link from 'next/link';
import { db } from '@stroller-transit-app/database/client';
import {
  stations,
  platforms,
  lines,
  lineDirections,
  trains,
  stationFacilities,
  stationConnections,
} from '@stroller-transit-app/database/schema';
import { eq, inArray, and, or, isNotNull } from 'drizzle-orm';
import { PlatformDisplay } from '@/components/PlatformDisplay';

type Props = {
  params: Promise<{ stationId: string }>;
};

async function fetchStationDetails(stationId: string) {
  // 駅の基本情報を取得
  const stationRecord = await db
    .select()
    .from(stations)
    .where(eq(stations.id, stationId))
    .limit(1);

  if (!stationRecord.length) {
    return null;
  }

  const station = stationRecord[0];

  // プラットフォーム情報を取得
  const platformList = await db
    .select({
      id: platforms.id,
      platformNumber: platforms.platformNumber,
      lineId: platforms.lineId,
      inboundDirectionId: platforms.inboundDirectionId,
      outboundDirectionId: platforms.outboundDirectionId,
      maxCarCount: platforms.maxCarCount,
      carStopPositions: platforms.carStopPositions,
      notes: platforms.notes,
    })
    .from(platforms)
    .where(eq(platforms.stationId, stationId));

  if (!platformList.length) {
    return { station, platforms: [], lines: [], directions: [], trains: [], facilities: [] };
  }

  // 路線情報を取得
  const lineIds = [...new Set(platformList.map((p) => p.lineId))];
  const lineList = await db
    .select()
    .from(lines)
    .where(inArray(lines.id, lineIds));

  // 方向情報を取得
  const directionIds = [
    ...new Set(
      platformList
        .flatMap((p) => [p.inboundDirectionId, p.outboundDirectionId])
        .filter((id): id is string => id !== null)
    ),
  ];
  const directionList =
    directionIds.length > 0
      ? await db
          .select()
          .from(lineDirections)
          .where(inArray(lineDirections.id, directionIds))
      : [];

  // 列車情報を取得（この駅の路線に停車する列車）
  const trainList = await db
    .select()
    .from(trains)
    .where(
      or(...lineIds.map((lineId) => inArray(lineId, trains.lines)))
    );

  // プラットフォーム設備を取得
  const platformIds = platformList.map((p) => p.id);
  const facilityList =
    platformIds.length > 0
      ? await db
          .select()
          .from(stationFacilities)
          .where(
            and(
              eq(stationFacilities.stationId, stationId),
              isNotNull(stationFacilities.platformId)
            )
          )
      : [];

  return {
    station,
    platforms: platformList,
    lines: lineList,
    directions: directionList,
    trains: trainList,
    facilities: facilityList,
  };
}

export default async function StationDetailPage({ params }: Props) {
  const { stationId } = await params;
  const data = await fetchStationDetails(stationId);

  if (!data) {
    notFound();
  }

  const { station, platforms: platformList, lines: lineList, directions, trains: trainList, facilities } = data;

  // 路線情報をマップ化
  const lineMap = Object.fromEntries(lineList.map((l) => [l.id, l]));
  const directionMap = Object.fromEntries(directions.map((d) => [d.id, d]));

  return (
    <main className="min-h-screen p-4 md:p-8 max-w-6xl mx-auto">
      {/* Back navigation */}
      <Link
        href="/"
        className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-4"
      >
        ← 路線一覧に戻る
      </Link>

      {/* Station header */}
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold mb-2">{station.name}</h1>
        {station.nameEn && (
          <p className="text-xl text-gray-600">{station.nameEn}</p>
        )}
        {station.code && (
          <p className="text-sm text-gray-500 mt-1">駅番号: {station.code}</p>
        )}
      </div>

      {/* Platform list */}
      {platformList.length > 0 ? (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold">プラットフォーム情報</h2>
          {platformList.map((platform) => {
            const line = lineMap[platform.lineId];
            const inboundDirection = platform.inboundDirectionId
              ? directionMap[platform.inboundDirectionId]
              : null;
            const outboundDirection = platform.outboundDirectionId
              ? directionMap[platform.outboundDirectionId]
              : null;

            // このプラットフォームの路線に停車する列車を取得
            const platformTrains = trainList.filter((train) =>
              train.lines?.includes(platform.lineId)
            );

            // このプラットフォームの設備を取得
            const platformFacilities = facilities.filter(
              (f) => f.platformId === platform.id
            );

            return (
              <PlatformDisplay
                key={platform.id}
                platform={platform}
                line={line}
                inboundDirection={inboundDirection}
                outboundDirection={outboundDirection}
                trains={platformTrains}
                facilities={platformFacilities}
              />
            );
          })}
        </div>
      ) : (
        <div className="text-center text-gray-500 py-12">
          <p>この駅のプラットフォーム情報がありません</p>
        </div>
      )}
    </main>
  );
}
