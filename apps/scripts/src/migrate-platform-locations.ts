import { db } from '@furatora/database/client';
import { platformLocations, platformLocationCells, stationFacilities } from '@furatora/database/schema';
import { count, isNull, sql } from 'drizzle-orm';

// postgres-js と neon-http でクエリ結果の型が異なるため共通化
function getRows<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  if (result && typeof result === 'object' && 'rows' in result) {
    return (result as { rows: T[] }).rows;
  }
  return [];
}

type OldPlatformLocation = {
  id: string;
  nearPlatformCell: number | null;
};

type OldStationFacility = {
  id: string;
  platformLocationId: string;
};

async function main() {
  console.log('=== platform_locations 移行スクリプト開始 ===');
  console.log('このスクリプトは0001マイグレーション適用後、0002適用前に実行してください\n');

  // 旧カラムの存在確認
  const colCheckPl = await db.execute(sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'platform_locations' AND column_name = 'near_platform_cell'
  `);
  const colCheckSf = await db.execute(sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'station_facilities' AND column_name = 'platform_location_id'
  `);

  if (getRows(colCheckPl).length === 0) {
    console.error('✗ platform_locations.near_platform_cell が存在しません。');
    console.error('  0002マイグレーション（クリーンアップ）が既に適用されている可能性があります。');
    process.exit(1);
  }
  if (getRows(colCheckSf).length === 0) {
    console.error('✗ station_facilities.platform_location_id が存在しません。');
    console.error('  0002マイグレーション（クリーンアップ）が既に適用されている可能性があります。');
    process.exit(1);
  }

  // 移行前の件数確認
  const [beforeLocCount] = await db.select({ count: count() }).from(platformLocations);
  const [beforeCellCount] = await db.select({ count: count() }).from(platformLocationCells);
  const [beforeFacCount] = await db.select({ count: count() }).from(stationFacilities);

  console.log('移行前:');
  console.log(`  platformLocations: ${beforeLocCount.count} 件`);
  console.log(`  platformLocationCells: ${beforeCellCount.count} 件`);
  console.log(`  stationFacilities: ${beforeFacCount.count} 件\n`);

  if (Number(beforeLocCount.count) === 0) {
    console.log('移行対象のデータが存在しません。終了します。');
    process.exit(0);
  }

  // TASK-2.1: 旧 near_platform_cell を読み取って platformLocationCells を作成
  const oldLocResult = await db.execute(sql`
    SELECT id, near_platform_cell AS "nearPlatformCell"
    FROM platform_locations
  `);
  const oldLocations = getRows<OldPlatformLocation>(oldLocResult);

  // 既にcellが存在する platformLocationId を除外
  const existingCells = await db
    .select({ platformLocationId: platformLocationCells.platformLocationId })
    .from(platformLocationCells);
  const existingCellLocationIds = new Set(existingCells.map(c => c.platformLocationId));

  const locationsWithoutCells = oldLocations.filter(
    loc => !existingCellLocationIds.has(loc.id)
  );

  console.log(`platformLocationCells 未作成の platformLocations: ${locationsWithoutCells.length} 件`);

  if (locationsWithoutCells.length > 0) {
    const cellsToInsert = locationsWithoutCells.map(loc => ({
      platformLocationId: loc.id,
      nearPlatformCell: loc.nearPlatformCell,
    }));
    await db.insert(platformLocationCells).values(cellsToInsert);
    console.log(`✓ ${cellsToInsert.length} 件の platformLocationCells を作成しました\n`);
  } else {
    console.log('✓ 全 platformLocations に platformLocationCells が存在します\n');
  }

  // TASK-2.1: stationFacilities の platformLocationCellId を platformLocationId から逆引きして設定
  const facilitiesResult = await db.execute(sql`
    SELECT id, platform_location_id AS "platformLocationId"
    FROM station_facilities
    WHERE platform_location_cell_id IS NULL
  `);
  const facilitiesNeedingUpdate = getRows<OldStationFacility>(facilitiesResult);

  console.log(`platformLocationCellId 未設定の stationFacilities: ${facilitiesNeedingUpdate.length} 件`);

  if (facilitiesNeedingUpdate.length > 0) {
    // platformLocationId → platformLocationCellId のマッピングを構築
    const allCells = await db
      .select({
        id: platformLocationCells.id,
        platformLocationId: platformLocationCells.platformLocationId,
      })
      .from(platformLocationCells);

    const locationToCellMap = new Map<string, string>();
    for (const cell of allCells) {
      if (!locationToCellMap.has(cell.platformLocationId)) {
        locationToCellMap.set(cell.platformLocationId, cell.id);
      }
    }

    let updatedCount = 0;
    for (const facility of facilitiesNeedingUpdate) {
      const cellId = locationToCellMap.get(facility.platformLocationId);
      if (!cellId) {
        console.warn(`  警告: platformLocation ${facility.platformLocationId} に対応するcellが見つかりません`);
        continue;
      }
      await db.execute(sql`
        UPDATE station_facilities SET platform_location_cell_id = ${cellId} WHERE id = ${facility.id}
      `);
      updatedCount++;
    }
    console.log(`✓ ${updatedCount} 件の stationFacilities を更新しました\n`);
  } else {
    console.log('✓ 全 stationFacilities に platformLocationCellId が設定済みです\n');
  }

  // === 検証 ===
  console.log('=== 検証 ===\n');

  // 検証1: platformLocations 件数が移行前後で一致する
  const [afterLocCount] = await db.select({ count: count() }).from(platformLocations);
  const countMatch = beforeLocCount.count === afterLocCount.count;
  console.log(
    `[${countMatch ? '✓' : '✗'}] platformLocations 件数一致: ${beforeLocCount.count} → ${afterLocCount.count}`
  );

  // 検証2: 全 platformLocations に platformLocationCells が1件以上存在する
  const coveredCells = await db
    .select({ platformLocationId: platformLocationCells.platformLocationId })
    .from(platformLocationCells);
  const coveredIds = new Set(coveredCells.map(c => c.platformLocationId));
  const uncoveredCount = oldLocations.filter(loc => !coveredIds.has(loc.id)).length;
  const allCovered = uncoveredCount === 0;
  console.log(
    `[${allCovered ? '✓' : '✗'}] 全 platformLocations に platformLocationCells が存在する` +
    (allCovered ? '' : `: ${uncoveredCount} 件が未カバー`)
  );

  // 検証3: 全 stationFacilities が有効な platformLocationCellId を参照する
  const [nullCellCount] = await db
    .select({ count: count() })
    .from(stationFacilities)
    .where(isNull(stationFacilities.platformLocationCellId));
  const allFacilitiesValid = nullCellCount.count === 0;
  const [afterFacCount] = await db.select({ count: count() }).from(stationFacilities);
  console.log(
    `[${allFacilitiesValid ? '✓' : '✗'}] 全 stationFacilities が有効な platformLocationCellId を参照する` +
    (allFacilitiesValid ? ` (${afterFacCount.count} 件)` : `: ${nullCellCount.count} 件が未設定`)
  );

  const [afterCellCount] = await db.select({ count: count() }).from(platformLocationCells);
  console.log('\n移行後:');
  console.log(`  platformLocations: ${afterLocCount.count} 件`);
  console.log(`  platformLocationCells: ${afterCellCount.count} 件`);
  console.log(`  stationFacilities: ${afterFacCount.count} 件`);

  if (!countMatch || !allCovered || !allFacilitiesValid) {
    console.error('\n✗ 検証に失敗しました。データを確認してください。');
    process.exit(1);
  }

  console.log('\n✓ 移行が正常に完了しました。');
  console.log('次のステップ: pnpm run db:migrate で 0002 クリーンアップマイグレーションを適用してください。');
  process.exit(0);
}

main().catch(err => {
  console.error('移行スクリプトでエラーが発生しました:', err);
  process.exit(1);
});
