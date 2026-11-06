import { db } from '@furatora/database/client';
import {
  stations,
  platforms,
  lines,
  lineDirections,
  trains,
  trainEquipments,
  trainCarStructures,
  trainStopPatterns,
  platformLocations,
  platformLocationCells,
  stationFacilities,
  facilityTypes,
  facilityConnections,
  stationConnections,
  stationLines,
} from '@furatora/database/schema';
import { asc, eq, inArray } from 'drizzle-orm';
import type { StationLayoutPageQuery, LayoutStopPatternDTO, LayoutConcourseDTO } from '@/features/station-layout/ports';
import {
  groupCarStructureByTrain, groupEquipmentsByTrainCar, stopPatternCarsOf,
} from '@furatora/platform-diagram/domain';
import { getLinesWithDirections } from '@/external/query/platformEditPageQuery';
import { getFacilityTypeOptions, getConnectedStationOptions } from '@/external/query/facilityEditPageQuery';
import { getAllTrainOptions } from '@/external/query/stopPatternPageQuery';
import { assertKnownFacilityCodes } from '@/features/facility/knownFacilityCodes';

// apps/web/src/external/query/stationDetailQuery.ts がベース。
// admin は未公開駅も編集対象のため publishedStation() を通さない。
// decimal → number の変換はここで完結させる（docs/domain/platform-coordinate-system.md「単位と精度」）

/** connectedStationId ごとの乗換路線名・色 */
async function getLinesByConnectedStation(connectedStationIds: string[]) {
  const map = new Map<string, { names: string[]; colors: (string | null)[] }>();
  if (connectedStationIds.length === 0) return map;

  const rows = await db
    .select({
      connectedStationId: stationConnections.connectedStationId,
      lineName: lines.name,
      lineColor: lines.color,
    })
    .from(stationConnections)
    .innerJoin(stationLines, eq(stationLines.stationId, stationConnections.connectedStationId))
    .innerJoin(lines, eq(lines.id, stationLines.lineId))
    .where(inArray(stationConnections.connectedStationId, connectedStationIds));

  const seen = new Set<string>();
  for (const row of rows) {
    const key = `${row.connectedStationId}:${row.lineName}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (!map.has(row.connectedStationId)) map.set(row.connectedStationId, { names: [], colors: [] });
    const entry = map.get(row.connectedStationId)!;
    entry.names.push(row.lineName);
    entry.colors.push(row.lineColor);
  }
  return map;
}

/** 1ホーム分のコンコース（アクセス点・設備・乗換込み） */
async function getConcourses(platformId: string): Promise<LayoutConcourseDTO[]> {
  const locationList = await db
    .select()
    .from(platformLocations)
    .where(eq(platformLocations.platformId, platformId))
    .orderBy(asc(platformLocations.createdAt));

  if (locationList.length === 0) return [];
  const locationIds = locationList.map((l) => l.id);

  const [cellList, connectionRows] = await Promise.all([
    db
      .select()
      .from(platformLocationCells)
      .where(inArray(platformLocationCells.platformLocationId, locationIds))
      .orderBy(asc(platformLocationCells.xPositionMeters)),
    db
      .select({
        platformLocationId: facilityConnections.platformLocationId,
        exitLabel: facilityConnections.exitLabel,
        connectedStationId: facilityConnections.connectedStationId,
        connectedPlatformId: facilityConnections.connectedPlatformId,
        directionId: facilityConnections.directionId,
        directionName: lineDirections.displayName,
        xRangeStart: facilityConnections.xRangeStart,
        xRangeEnd: facilityConnections.xRangeEnd,
      })
      .from(facilityConnections)
      .leftJoin(lineDirections, eq(facilityConnections.directionId, lineDirections.id))
      .where(inArray(facilityConnections.platformLocationId, locationIds)),
  ]);

  const cellIds = cellList.map((c) => c.id);
  const [facilityList, facilityTypeList, linesByStation] = await Promise.all([
    cellIds.length > 0
      ? db.select().from(stationFacilities).where(inArray(stationFacilities.platformLocationCellId, cellIds))
      : Promise.resolve([]),
    db.select({ code: facilityTypes.code, name: facilityTypes.name }).from(facilityTypes),
    getLinesByConnectedStation([...new Set(connectionRows.map((c) => c.connectedStationId))]),
  ]);

  // 保存はアクセス点の設備を置き換える（消して入れ直す）。知らないコードを捨てて表示すると、保存しただけで
  // その行が DB から消えるため、画面を開かせずに止める（UnknownFacilityCodeError）
  assertKnownFacilityCodes(facilityList.map((f) => f.typeCode));
  const facilityTypeMap = Object.fromEntries(facilityTypeList.map((t) => [t.code, t.name]));
  const facilitiesByCell = new Map(cellIds.map((id) => [id, facilityList.filter((f) => f.platformLocationCellId === id)]));
  const cellsByLocation = new Map(locationIds.map((id) => [id, cellList.filter((c) => c.platformLocationId === id)]));
  const connectionsByLocation = new Map<string, typeof connectionRows>();
  for (const row of connectionRows) {
    if (!connectionsByLocation.has(row.platformLocationId)) connectionsByLocation.set(row.platformLocationId, []);
    connectionsByLocation.get(row.platformLocationId)!.push(row);
  }

  return locationList.map((loc) => ({
    id: loc.id,
    exits: loc.exits,
    notes: loc.notes,
    cells: (cellsByLocation.get(loc.id) ?? []).map((cell) => ({
      id: cell.id,
      xPositionMeters: cell.xPositionMeters !== null ? Number(cell.xPositionMeters) : null,
      facilities: (facilitiesByCell.get(cell.id) ?? []).map((f) => ({
        id: f.id,
        typeCode: f.typeCode,
        typeName: facilityTypeMap[f.typeCode] ?? f.typeCode,
      })),
    })),
    connections: (connectionsByLocation.get(loc.id) ?? []).map((c) => ({
      connectedStationId: c.connectedStationId,
      connectedPlatformId: c.connectedPlatformId,
      directionId: c.directionId,
      lineNames: linesByStation.get(c.connectedStationId)?.names ?? [],
      lineColors: linesByStation.get(c.connectedStationId)?.colors ?? [],
      directionName: c.directionName ?? null,
      exitLabel: c.exitLabel,
      xRangeStart: c.xRangeStart !== null ? Number(c.xRangeStart) : null,
      xRangeEnd: c.xRangeEnd !== null ? Number(c.xRangeEnd) : null,
    })),
  }));
}

/** 1ホーム分の停車位置パターン（列車・号車・ドア設備込み） */
async function getStopPatterns(platformId: string): Promise<LayoutStopPatternDTO[]> {
  const patternRows = await db
    .select({
      id: trainStopPatterns.id,
      trainId: trainStopPatterns.trainId,
      carOneOuterMeters: trainStopPatterns.carOneOuterMeters,
      carNumbersAscendToward: trainStopPatterns.carNumbersAscendToward,
    })
    .from(trainStopPatterns)
    .where(eq(trainStopPatterns.platformId, platformId));

  if (patternRows.length === 0) return [];

  const trainIds = [...new Set(patternRows.map((p) => p.trainId))];

  const [trainRows, carStructureRows, equipmentRows] = await Promise.all([
    db.select({ id: trains.id, name: trains.name, carCount: trains.carCount }).from(trains).where(inArray(trains.id, trainIds)),
    db
      .select({
        trainId: trainCarStructures.trainId,
        carNumber: trainCarStructures.carNumber,
        doorCount: trainCarStructures.doorCount,
        carLength: trainCarStructures.carLength,
      })
      .from(trainCarStructures)
      .where(inArray(trainCarStructures.trainId, trainIds)),
    db.select().from(trainEquipments).where(inArray(trainEquipments.trainId, trainIds)),
  ]);

  const trainById = new Map(trainRows.map((t) => [t.id, t]));

  // decimal の carLength はここで number にする（DTOより上に string を渡さない）
  const carStructureByTrain = groupCarStructureByTrain(carStructureRows);

  const equipmentsByTrainCar = groupEquipmentsByTrainCar(equipmentRows);

  const dtos: LayoutStopPatternDTO[] = [];
  for (const pattern of patternRows) {
    const train = trainById.get(pattern.trainId);
    if (!train) continue; // 参照整合性が壊れている場合はスキップ

    // 号車の区間は保存せず、号車構成と基準点から算出する（ADR-0025）
    const cars = stopPatternCarsOf(
      pattern, train.carCount, carStructureByTrain.get(train.id) ?? [], equipmentsByTrainCar,
    );

    dtos.push({
      patternId: pattern.id,
      trainId: train.id,
      trainLabel: train.name,
      carCount: train.carCount,
      carNumbersAscendToward: pattern.carNumbersAscendToward,
      cars,
    });
  }

  // trainStopPatterns に表示順カラムが無いため、決定性を保つよう id まで含めて並べる
  return dtos.sort((a, b) => a.carCount - b.carCount || a.trainLabel.localeCompare(b.trainLabel) || a.patternId.localeCompare(b.patternId));
}

export const dbStationLayoutPageQuery: StationLayoutPageQuery = {
  async getContext(stationId, selection) {
    // インスペクタの選択肢データは選択中ホームに依存しないため、station/platformList と
    // 並列に取得する（facilityEditPageQuery/platformEditPageQuery/stopPatternPageQuery を再利用）
    const [
      [stationRow], platformList, linesWithDirections, facilityTypeOptions, connectedStations, trainOptions,
    ] = await Promise.all([
      db.select({ name: stations.name }).from(stations).where(eq(stations.id, stationId)),
      db
        .select({
          id: platforms.id,
          platformNumber: platforms.platformNumber,
          lineId: platforms.lineId,
          inboundDirectionId: platforms.inboundDirectionId,
          outboundDirectionId: platforms.outboundDirectionId,
          physicalLength: platforms.physicalLength,
          notes: platforms.notes,
        })
        .from(platforms)
        .where(eq(platforms.stationId, stationId))
        .orderBy(asc(platforms.platformNumber)),
      getLinesWithDirections(stationId),
      getFacilityTypeOptions(),
      getConnectedStationOptions(stationId),
      getAllTrainOptions(),
    ]);
    if (!stationRow) return null;

    const options = {
      lines: linesWithDirections,
      facilityTypes: facilityTypeOptions,
      connectedStations,
      trains: trainOptions,
    };

    // UUID形式の検証はページ側の parseUuidParam が担い、ここでは駅への所属のみ検証する
    const selected = platformList.find((p) => p.id === selection.platformId) ?? platformList[0];
    if (!selected) return { stationName: stationRow.name, platforms: [], platform: null, ...options };

    const directionIds = [selected.inboundDirectionId, selected.outboundDirectionId].filter((id): id is string => id !== null);
    const [stopPatterns, concourses, [line], directionList] = await Promise.all([
      getStopPatterns(selected.id),
      getConcourses(selected.id),
      db.select({ name: lines.name, color: lines.color }).from(lines).where(eq(lines.id, selected.lineId)),
      directionIds.length > 0
        ? db
          .select({ id: lineDirections.id, displayName: lineDirections.displayName })
          .from(lineDirections)
          .where(inArray(lineDirections.id, directionIds))
        : Promise.resolve([]),
    ]);
    const directionName = (id: string | null) => directionList.find((d) => d.id === id)?.displayName ?? null;
    const selectedPattern = stopPatterns.find((p) => p.patternId === selection.patternId) ?? stopPatterns[0];

    return {
      stationName: stationRow.name,
      platforms: platformList.map((p) => ({ id: p.id, platformNumber: p.platformNumber })),
      ...options,
      platform: {
        id: selected.id,
        platformNumber: selected.platformNumber,
        lineId: selected.lineId,
        lineName: line?.name ?? '',
        lineColor: line?.color ?? null,
        inboundDirectionId: selected.inboundDirectionId,
        inboundDirectionName: directionName(selected.inboundDirectionId),
        outboundDirectionId: selected.outboundDirectionId,
        outboundDirectionName: directionName(selected.outboundDirectionId),
        notes: selected.notes,
        physicalLength: Number(selected.physicalLength),
        stopPatterns,
        concourses,
        selectedPatternId: selectedPattern?.patternId ?? null,
      },
    };
  },
};
