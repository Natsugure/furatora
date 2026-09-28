import { db } from '@furatora/database/client';
import {
  stations,
  stationLines,
  platforms,
  lines,
  lineDirections,
  trains,
  trainEquipments,
  trainCarStructures,
  trainStopPatterns,
  trainStopPatternCars,
  platformLocations,
  platformLocationCells,
  stationFacilities,
  facilityTypes,
  facilityConnections,
  stationConnections,
} from '@furatora/database/schema';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { publishedStation } from './visibility';
import type { StationDetailQuery } from '@/features/station/ports';
import type { StationDetailDTO } from '@/features/station/domain/types';
import { buildTransferPartners, getTransferConnectionRows, type PartnerLine } from './transferPartnerRows';
import type {
  ConcourseDTO,
  PlatformDTO,
  StopPatternCarDTO,
  TrainStopPatternDTO,
} from '@furatora/platform-diagram/domain';

// apps/admin/src/external/query/stopPatternPageQuery.ts のスタイルを踏襲する。
// decimal → number の変換はすべてここで完結させる（DTOより上に string を渡さない）。

// connectedRailwayId 列は廃止済み（ODPT 同期専用の列であり、以後 ODPT 同期は行わない。
// ADR-0007 決定3 / Issue #56）。路線名は connectedStationId → stationLines → lines の
// join で解決する。駅マスタは路線ごとに駅を割るモデルのため、接続先の駅が決まれば
// 路線が一意に定まる（複数路線を持つ駅は実測0件。ただし不変条件ではないので lineName で重複除去して吸収する）。
// 詳細: docs/domain/station-master-model.md「乗換接続（stationConnections）」。
//
// 接続先の駅には publishedStation() を通さない（stations は駅名のためだけに join する）。
// ここが供給するのは「乗換先の路線名・駅名」と「乗換難易度の相手駅」だけで、接続先の駅ページへのリンクは一切生成しない。
// 未公開駅を除外すると路線名が丸ごと引けなくなり、図の乗換プレートが空になる
// （docs/domain/station-visibility.md「乗換接続からの到達」/ Issue #77 REQ-7.4b）。
// リンクを伴う参照を後から足す場合は、そのとき publishedStation() を通すこと。
async function getStationConnectionRows(stationId: string) {
  return db
    .select({
      connectedStationId: stationConnections.connectedStationId,
      connectedStationName: stations.name,
      lineName: lines.name,
      lineColor: lines.color,
    })
    .from(stationConnections)
    .innerJoin(stations, eq(stations.id, stationConnections.connectedStationId))
    .innerJoin(stationLines, eq(stationLines.stationId, stationConnections.connectedStationId))
    .innerJoin(lines, eq(lines.id, stationLines.lineId))
    .where(eq(stationConnections.stationId, stationId));
}

// 乗換先の相手駅と路線。2路線を持つ駅（実測0件。#82 で物理駅粒度に統合されると生じうる）は
// connectedStationId ごとに複数行になるため、
// 同一路線の重複を除く。乗換難易度が未評価の相手駅も含める（未評価は表示層が「情報なし」と示す）
function buildPartnerLines(rows: Awaited<ReturnType<typeof getStationConnectionRows>>) {
  const seen = new Set<string>();
  const result: PartnerLine[] = [];
  for (const r of rows) {
    const key = `${r.connectedStationId}:${r.lineName}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({
      connectedStationId: r.connectedStationId,
      connectedStationName: r.connectedStationName,
      lineName: r.lineName,
      lineColor: r.lineColor,
    });
  }
  return result;
}

// connectedStationId ごとの乗換路線名・色（facilityConnections のラベル付けに使う）。
// 重複除去は buildPartnerLines の1か所に置く（乗換セクションと図の乗換プレートで路線一覧を食い違わせない）
function buildLinesByStation(partnerLines: PartnerLine[]) {
  const map = new Map<string, { names: string[]; colors: (string | null)[] }>();
  for (const p of partnerLines) {
    const entry = map.get(p.connectedStationId) ?? { names: [], colors: [] };
    entry.names.push(p.lineName);
    entry.colors.push(p.lineColor);
    map.set(p.connectedStationId, entry);
  }
  return map;
}

export const dbStationDetailQuery: StationDetailQuery = {
  async getBySlug(slug) {
    // 未公開駅は 404（該当なし）にする。CHECK 制約 published_requires_slug により
    // 公開駅は必ず slug を持つため、この条件を足しても公開駅の到達性は変わらない
    // （docs/domain/station-visibility.md）。
    const [stationRow] = await db
      .select()
      .from(stations)
      .where(and(eq(stations.slug, slug), publishedStation()))
      .limit(1);
    if (!stationRow) return null;

    const [headerLineRows, platformList, stationConnectionRows, transferConnectionRows] = await Promise.all([
      db
        .select({ color: lines.color })
        .from(stationLines)
        .innerJoin(lines, eq(stationLines.lineId, lines.id))
        .where(eq(stationLines.stationId, stationRow.id))
        .limit(1),
      db
        .select({
          id: platforms.id,
          platformNumber: platforms.platformNumber,
          lineId: platforms.lineId,
          inboundDirectionId: platforms.inboundDirectionId,
          outboundDirectionId: platforms.outboundDirectionId,
          physicalLength: platforms.physicalLength,
          platformSide: platforms.platformSide,
          notes: platforms.notes,
        })
        .from(platforms)
        .where(eq(platforms.stationId, stationRow.id)),
      getStationConnectionRows(stationRow.id),
      getTransferConnectionRows(stationRow.id),
    ]);

    const baseDTO: Omit<StationDetailDTO, 'platforms' | 'transferPartners'> = {
      station: {
        id: stationRow.id,
        name: stationRow.name,
        nameEn: stationRow.nameEn,
        code: stationRow.code,
        notes: stationRow.notes,
      },
      headerLineColor: headerLineRows[0]?.color ?? null,
    };
    const partnerLines = buildPartnerLines(stationConnectionRows);
    // 乗換の読み取りはホーム側のクエリに依存しないので、次の Promise.all に載せて往復を増やさない
    const transferPartnersPromise = buildTransferPartners(stationRow.id, partnerLines, transferConnectionRows);

    if (platformList.length === 0) {
      return { ...baseDTO, transferPartners: await transferPartnersPromise, platforms: [] };
    }

    const platformIds = platformList.map((p) => p.id);
    const lineIds = [...new Set(platformList.map((p) => p.lineId))];
    const directionIds = [
      ...new Set(
        platformList
          .flatMap((p) => [p.inboundDirectionId, p.outboundDirectionId])
          .filter((id): id is string => id !== null),
      ),
    ];

    const [lineList, directionList, facilityTypeList, transferPartners] = await Promise.all([
      db.select().from(lines).where(inArray(lines.id, lineIds)),
      directionIds.length > 0
        ? db.select().from(lineDirections).where(inArray(lineDirections.id, directionIds))
        : Promise.resolve([]),
      db.select().from(facilityTypes),
      transferPartnersPromise,
    ]);

    const lineMap = new Map(lineList.map((l) => [l.id, l]));
    const directionMap = new Map(directionList.map((d) => [d.id, d]));
    const facilityTypeMap = Object.fromEntries(facilityTypeList.map((t) => [t.code, t.name]));

    // 列車の表示判定は「そのホーム・列車の組み合わせに停車位置パターンが登録されているか」のみ
    // （docs/domain/train-stop-patterns.md「列車の表示判定」）
    const patternRows = await db
      .select({
        id: trainStopPatterns.id,
        platformId: trainStopPatterns.platformId,
        trainId: trainStopPatterns.trainId,
      })
      .from(trainStopPatterns)
      .where(inArray(trainStopPatterns.platformId, platformIds));

    const patternIds = patternRows.map((p) => p.id);
    const trainIds = [...new Set(patternRows.map((p) => p.trainId))];

    const [trainRows, carRows, carStructureRows, equipmentRows] = await Promise.all([
      trainIds.length > 0
        ? db.select({ id: trains.id, name: trains.name, carCount: trains.carCount })
            .from(trains).where(inArray(trains.id, trainIds))
        : Promise.resolve([]),
      patternIds.length > 0
        ? db
            .select({
              trainStopPatternId: trainStopPatternCars.trainStopPatternId,
              carNumber: trainStopPatternCars.carNumber,
              startMeters: trainStopPatternCars.startMeters,
              endMeters: trainStopPatternCars.endMeters,
            })
            .from(trainStopPatternCars)
            .where(inArray(trainStopPatternCars.trainStopPatternId, patternIds))
            .orderBy(asc(trainStopPatternCars.carNumber))
        : Promise.resolve([]),
      trainIds.length > 0
        ? db
            .select({
              trainId: trainCarStructures.trainId,
              carNumber: trainCarStructures.carNumber,
              doorCount: trainCarStructures.doorCount,
            })
            .from(trainCarStructures)
            .where(inArray(trainCarStructures.trainId, trainIds))
        : Promise.resolve([]),
      trainIds.length > 0
        ? db.select().from(trainEquipments).where(inArray(trainEquipments.trainId, trainIds))
        : Promise.resolve([]),
    ]);

    const trainById = new Map(trainRows.map((t) => [t.id, t]));

    const doorCountByTrainCar = new Map<string, number>();
    for (const row of carStructureRows) {
      doorCountByTrainCar.set(`${row.trainId}:${row.carNumber}`, row.doorCount);
    }

    const equipmentsByTrainCar = new Map<
      string,
      { free: { nearDoor: number; isStandard: boolean }[]; prio: { nearDoor: number; isStandard: boolean }[] }
    >();
    for (const row of equipmentRows) {
      const key = `${row.trainId}:${row.carNumber}`;
      if (!equipmentsByTrainCar.has(key)) equipmentsByTrainCar.set(key, { free: [], prio: [] });
      const entry = equipmentsByTrainCar.get(key)!;
      const item = { nearDoor: row.nearDoor, isStandard: row.isStandard };
      if (row.type === 'free_space') entry.free.push(item);
      else entry.prio.push(item);
    }

    const stopPatternsByPlatformId = new Map<string, TrainStopPatternDTO[]>();
    for (const pattern of patternRows) {
      const train = trainById.get(pattern.trainId);
      if (!train) continue; // 参照整合性が壊れている場合はスキップ

      const cars: StopPatternCarDTO[] = carRows
        .filter((c) => c.trainStopPatternId === pattern.id)
        .map((c) => {
          const key = `${pattern.trainId}:${c.carNumber}`;
          const equipments = equipmentsByTrainCar.get(key);
          return {
            carNumber: c.carNumber,
            startMeters: Number(c.startMeters),
            endMeters: Number(c.endMeters),
            doorCount: doorCountByTrainCar.get(key) ?? 4,
            freeSpaceDoors: equipments?.free ?? [],
            prioritySeatDoors: equipments?.prio ?? [],
          };
        });

      const dto: TrainStopPatternDTO = {
        trainId: train.id,
        trainLabel: train.name,
        carCount: train.carCount,
        cars,
      };

      const existing = stopPatternsByPlatformId.get(pattern.platformId) ?? [];
      stopPatternsByPlatformId.set(pattern.platformId, [...existing, dto]);
    }

    // コンコース（platformLocations → platformLocationCells → stationFacilities / facilityConnections）
    const locationList = await db
      .select()
      .from(platformLocations)
      .where(inArray(platformLocations.platformId, platformIds));

    const locationIds = locationList.map((l) => l.id);

    const [cellList, connectionRows] = locationIds.length > 0
      ? await Promise.all([
          db.select().from(platformLocationCells).where(inArray(platformLocationCells.platformLocationId, locationIds)),
          // 接続先駅の公開状態では絞らない（stations を join しないのも同じ理由）。
          // ここで返すのはリンクを伴わない表示用の情報のみ（Issue #77 REQ-7.4b）。
          // "修正"して publishedStation() を足さないこと。
          db
            .select({
              platformLocationId: facilityConnections.platformLocationId,
              exitLabel: facilityConnections.exitLabel,
              connectedStationId: facilityConnections.connectedStationId,
              directionName: lineDirections.displayName,
              xRangeStart: facilityConnections.xRangeStart,
              xRangeEnd: facilityConnections.xRangeEnd,
            })
            .from(facilityConnections)
            .leftJoin(lineDirections, eq(facilityConnections.directionId, lineDirections.id))
            .where(inArray(facilityConnections.platformLocationId, locationIds)),
        ])
      : [[], []];

    const cellIds = cellList.map((c) => c.id);
    const facilityList = cellIds.length > 0
      ? await db.select().from(stationFacilities).where(inArray(stationFacilities.platformLocationCellId, cellIds))
      : [];

    const linesByStation = buildLinesByStation(partnerLines);

    const facilitiesByCell = new Map(cellIds.map((id) => [id, facilityList.filter((f) => f.platformLocationCellId === id)]));
    const cellsByLocation = new Map(locationIds.map((id) => [id, cellList.filter((c) => c.platformLocationId === id)]));
    const connectionsByLocation = new Map<string, typeof connectionRows>();
    for (const row of connectionRows) {
      const existing = connectionsByLocation.get(row.platformLocationId) ?? [];
      connectionsByLocation.set(row.platformLocationId, [...existing, row]);
    }

    const concoursesByPlatformId = new Map<string, ConcourseDTO[]>();
    for (const loc of locationList) {
      const dto: ConcourseDTO = {
        id: loc.id,
        exits: loc.exits,
        cells: (cellsByLocation.get(loc.id) ?? []).map((cell) => ({
          xPositionMeters: cell.xPositionMeters !== null ? Number(cell.xPositionMeters) : null,
          facilities: (facilitiesByCell.get(cell.id) ?? []).map((f) => ({
            id: f.id,
            typeCode: f.typeCode,
            typeName: facilityTypeMap[f.typeCode] ?? f.typeCode,
            isWheelchairAccessible: f.isWheelchairAccessible,
            isStrollerAccessible: f.isStrollerAccessible,
          })),
        })),
        connections: (connectionsByLocation.get(loc.id) ?? []).map((c) => ({
          lineNames: linesByStation.get(c.connectedStationId)?.names ?? [],
          lineColors: linesByStation.get(c.connectedStationId)?.colors ?? [],
          directionName: c.directionName ?? null,
          exitLabel: c.exitLabel,
          xRangeStart: c.xRangeStart !== null ? Number(c.xRangeStart) : null,
          xRangeEnd: c.xRangeEnd !== null ? Number(c.xRangeEnd) : null,
        })),
      };
      const existing = concoursesByPlatformId.get(loc.platformId) ?? [];
      concoursesByPlatformId.set(loc.platformId, [...existing, dto]);
    }

    const platformDTOs: PlatformDTO[] = platformList.map((p) => {
      const line = lineMap.get(p.lineId);
      const inboundDirection = p.inboundDirectionId ? directionMap.get(p.inboundDirectionId) : undefined;
      const outboundDirection = p.outboundDirectionId ? directionMap.get(p.outboundDirectionId) : undefined;
      const platformSide = p.platformSide === 'top' || p.platformSide === 'bottom' ? p.platformSide : null;

      return {
        id: p.id,
        platformNumber: p.platformNumber,
        lineId: p.lineId,
        lineName: line?.name ?? '',
        lineColor: line?.color ?? null,
        inboundDirectionId: p.inboundDirectionId,
        inboundDirectionName: inboundDirection?.displayName ?? null,
        outboundDirectionId: p.outboundDirectionId,
        outboundDirectionName: outboundDirection?.displayName ?? null,
        platformSide,
        notes: p.notes,
        physicalLength: Number(p.physicalLength),
        stopPatterns: stopPatternsByPlatformId.get(p.id) ?? [],
        concourses: concoursesByPlatformId.get(p.id) ?? [],
      };
    });

    return { ...baseDTO, transferPartners, platforms: platformDTOs };
  },
};
