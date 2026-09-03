import { describe, it, expect } from 'vitest';
import { computeImportPlan } from './plan';
import type {
  ImportedRecords,
  ImportedStation,
  MasterSnapshot,
} from './importedRecords';

const RUN_DATE = '2026-09-03';

function records(overrides: Partial<ImportedRecords> = {}): ImportedRecords {
  const base = {
    operators: [{ ekidataCompanyCd: 18, name: '東京メトロ' }],
    lines: [
      {
        ekidataLineCd: 99301,
        ekidataCompanyCd: 18,
        name: '東京メトロ丸ノ内線',
        nameKana: 'トウキョウメトロマルノウチセン',
        color: '#F62E36',
      },
    ],
    stationGroups: [
      {
        ekidataStationGroupCd: 1130208,
        name: '新宿',
        nameKana: 'シンジュク',
        prefCode: 13,
        lat: '35.690921',
        lon: '139.700258',
      },
    ],
    stations: [station(9930101, 1130208, '新宿')],
    adjacencies: [],
    closures: { lines: new Map(), stations: new Map() },
    warnings: [],
    ...overrides,
  };
  // 既定では「取り込んだコード = CSV に載っていたコード」。取り込まなかった行を
  // 廃止扱いにしないことを検証するテストだけ seen を明示的に渡す
  return {
    ...base,
    seen: overrides.seen ?? {
      lines: new Set(base.lines.map((l) => l.ekidataLineCd)),
      stations: new Set(base.stations.map((s) => s.ekidataStationCd)),
    },
  };
}

function station(
  cd: number,
  groupCd: number,
  name: string,
  overrides: Partial<ImportedStation> = {},
): ImportedStation {
  return {
    ekidataStationCd: cd,
    ekidataLineCd: 99301,
    ekidataStationGroupCd: groupCd,
    name,
    nameKana: 'シンジュク',
    lat: '35.690921',
    lon: '139.700258',
    prefCode: 13,
    ...overrides,
  };
}

function snapshot(overrides: Partial<MasterSnapshot> = {}): MasterSnapshot {
  return {
    operators: [],
    lines: [],
    stationGroups: [],
    stations: [],
    stationLinePairs: [],
    stationAdjacencyKeys: [],
    ...overrides,
  };
}

/** records() をそのまま取り込んだ後の DB の姿 */
function snapshotMatching(): MasterSnapshot {
  return snapshot({
    operators: [{ id: 'op-1', name: '東京メトロ', ekidataCompanyCd: 18 }],
    lines: [
      {
        id: 'line-1',
        ekidataLineCd: 99301,
        name: '東京メトロ丸ノ内線',
        nameKana: 'トウキョウメトロマルノウチセン',
        color: '#F62E36',
        abolishedAt: null,
      },
    ],
    stationGroups: [
      {
        id: 'group-1',
        ekidataStationGroupCd: 1130208,
        name: '新宿',
        nameKana: 'シンジュク',
        prefCode: 13,
        lat: '35.690921',
        lon: '139.700258',
      },
    ],
    stations: [
      {
        id: 'station-1',
        ekidataStationCd: 9930101,
        name: '新宿',
        nameKana: 'シンジュク',
        lat: '35.690921',
        lon: '139.700258',
        prefCode: 13,
        stationGroupId: 'group-1',
        abolishedAt: null,
      },
    ],
    stationLinePairs: [{ stationId: 'station-1', lineId: 'line-1' }],
  });
}

describe('新規の判定', () => {
  it('空のDBに対しては全件が新規になる', () => {
    const plan = computeImportPlan(records(), snapshot(), RUN_DATE);
    expect(plan.summary.operators).toEqual({ created: 1, updated: 0, unchanged: 0, abolished: 0 });
    expect(plan.summary.lines.created).toBe(1);
    expect(plan.summary.stationGroups.created).toBe(1);
    expect(plan.summary.stations.created).toBe(1);
    expect(plan.summary.stationLines.created).toBe(1);
    expect(plan.blockers).toEqual([]);
  });
});

// REQ-1.5
describe('冪等性', () => {
  it('同じCSVを再投入すると差分が0件になる', () => {
    const plan = computeImportPlan(records(), snapshotMatching(), RUN_DATE);

    expect(plan.summary.operators).toEqual({ created: 0, updated: 0, unchanged: 1, abolished: 0 });
    expect(plan.summary.lines).toEqual({ created: 0, updated: 0, unchanged: 1, abolished: 0 });
    expect(plan.summary.stationGroups).toEqual({
      created: 0,
      updated: 0,
      unchanged: 1,
      abolished: 0,
    });
    expect(plan.summary.stations).toEqual({ created: 0, updated: 0, unchanged: 1, abolished: 0 });
    expect(plan.summary.stationLines.created).toBe(0);
    expect(plan.summary.stationAdjacencies.created).toBe(0);
  });

  // CSV は '139.74044'、DB から読み戻すと '139.740440' になる。
  // 桁を揃えずに比較すると、値が同じでも毎回「更新あり」になる
  it.each([
    ['取り込み側の桁が少ない', '139.7', '139.700000'],
    ['DB側の桁が少ない', '139.700000', '139.7'],
  ])('lat / lon の桁数の違いを差分と見なさない（%s）', (_label, incoming, current) => {
    const base = snapshotMatching();
    const plan = computeImportPlan(
      records({ stations: [station(9930101, 1130208, '新宿', { lon: incoming })] }),
      snapshot({ ...base, stations: [{ ...base.stations[0]!, lon: current }] }),
      RUN_DATE,
    );
    expect(plan.summary.stations.unchanged).toBe(1);
  });

  it('路線色の # の有無と大文字小文字を差分と見なさない', () => {
    const base = snapshotMatching();
    const plan = computeImportPlan(
      records(),
      snapshot({ ...base, lines: [{ ...base.lines[0]!, color: '#f62e36' }] }),
      RUN_DATE,
    );
    expect(plan.summary.lines.unchanged).toBe(1);
  });
});

// REQ-2.2
describe('空値では上書きしない', () => {
  it('CSV のカナが空なら既存のカナを保つ', () => {
    const base = snapshotMatching();
    const plan = computeImportPlan(
      records({ stations: [station(9930101, 1130208, '新宿', { nameKana: null })] }),
      base,
      RUN_DATE,
    );
    expect(plan.summary.stations.unchanged).toBe(1);
    expect(plan.changes.stations.write).toEqual([]);
  });

  it('CSV の路線色が空なら既存の色を保つ', () => {
    const plan = computeImportPlan(
      records({
        lines: [
          {
            ekidataLineCd: 99301,
            ekidataCompanyCd: 18,
            name: '東京メトロ丸ノ内線',
            nameKana: 'トウキョウメトロマルノウチセン',
            color: null,
          },
        ],
      }),
      snapshotMatching(),
      RUN_DATE,
    );
    expect(plan.summary.lines.unchanged).toBe(1);
  });

  it('値が実際に変わるときだけ更新にする', () => {
    const plan = computeImportPlan(
      records({ stations: [station(9930101, 1130208, '新宿三丁目')] }),
      snapshotMatching(),
      RUN_DATE,
    );
    expect(plan.summary.stations.updated).toBe(1);
    expect(plan.changes.stations.write).toEqual([station(9930101, 1130208, '新宿三丁目')]);
  });
});

// REQ-2.1
describe('触らない列', () => {
  // 書き込み対象に ekidata 由来でない列（slug / nameEn / publishedAt / notes 等）が
  // そもそも載らないことを、形で保証する
  it('駅の書き込みは ekidata が持つ列だけを含む', () => {
    const plan = computeImportPlan(
      records({ stations: [station(9930101, 1130208, '新宿三丁目')] }),
      snapshotMatching(),
      RUN_DATE,
    );
    expect(Object.keys(plan.changes.stations.write[0]!).sort()).toEqual([
      'ekidataLineCd',
      'ekidataStationCd',
      'ekidataStationGroupCd',
      'lat',
      'lon',
      'name',
      'nameKana',
      'prefCode',
    ]);
  });

  it('事業者の書き込みは name とコードだけを含む（displayPriority を触らない）', () => {
    const plan = computeImportPlan(
      records({ operators: [{ ekidataCompanyCd: 18, name: '東京地下鉄' }] }),
      snapshotMatching(),
      RUN_DATE,
    );
    expect(Object.keys(plan.changes.operators.write[0]!).sort()).toEqual([
      'ekidataCompanyCd',
      'name',
    ]);
  });
});

// REQ-8.3
describe('廃止の記録', () => {
  it('CSV から消えた駅に実行日で廃止日を立てる。行は削除しない', () => {
    const plan = computeImportPlan(
      records({ stations: [] }),
      snapshotMatching(),
      RUN_DATE,
    );
    expect(plan.summary.stations.abolished).toBe(1);
    expect(plan.changes.stations.abolish).toEqual([{ id: 'station-1', abolishedAt: RUN_DATE }]);
  });

  it('CSV に廃止日があればそれを使う', () => {
    const plan = computeImportPlan(
      records({
        stations: [],
        closures: { lines: new Map(), stations: new Map([[9930101, '2020-04-01']]) },
      }),
      snapshotMatching(),
      RUN_DATE,
    );
    expect(plan.changes.stations.abolish).toEqual([
      { id: 'station-1', abolishedAt: '2020-04-01' },
    ]);
  });

  it('既に廃止済みの行は上書きしない', () => {
    const base = snapshotMatching();
    const plan = computeImportPlan(
      records({ stations: [] }),
      snapshot({
        ...base,
        stations: [{ ...base.stations[0]!, abolishedAt: '2019-01-01' }],
      }),
      RUN_DATE,
    );
    expect(plan.summary.stations.abolished).toBe(0);
  });

  it('ekidata コードを持たない行（未突合）は廃止しない', () => {
    const base = snapshotMatching();
    const plan = computeImportPlan(
      records({ stations: [] }),
      snapshot({
        ...base,
        stations: [{ ...base.stations[0]!, ekidataStationCd: null }],
      }),
      RUN_DATE,
    );
    expect(plan.summary.stations.abolished).toBe(0);
  });

  // 古い company.csv などで路線・駅が取り込み対象から外れても、CSV には載っている。
  // 「消えた」わけではないので、公開中の行を廃止してはならない
  it('CSV に載っているが取り込まなかった駅は廃止しない', () => {
    const plan = computeImportPlan(
      records({
        stations: [],
        seen: { lines: new Set([99301]), stations: new Set([9930101]) },
      }),
      snapshotMatching(),
      RUN_DATE,
    );
    expect(plan.summary.stations.abolished).toBe(0);
    expect(plan.changes.stations.abolish).toEqual([]);
  });

  it('CSV に載っているが取り込まなかった路線は廃止しない', () => {
    const plan = computeImportPlan(
      records({
        lines: [],
        seen: { lines: new Set([99301]), stations: new Set([9930101]) },
      }),
      snapshotMatching(),
      RUN_DATE,
    );
    expect(plan.summary.lines.abolished).toBe(0);
    expect(plan.changes.lines.abolish).toEqual([]);
  });

  it('CSV のどのファイルにも現れない駅は実行日で廃止する', () => {
    const plan = computeImportPlan(
      records({
        stations: [],
        seen: { lines: new Set([99301]), stations: new Set() },
      }),
      snapshotMatching(),
      RUN_DATE,
    );
    expect(plan.changes.stations.abolish).toEqual([{ id: 'station-1', abolishedAt: RUN_DATE }]);
  });

  it('廃止済みの駅が現役として再登場したら廃止を取り消す', () => {
    const base = snapshotMatching();
    const plan = computeImportPlan(
      records(),
      snapshot({
        ...base,
        stations: [{ ...base.stations[0]!, abolishedAt: '2019-01-01' }],
      }),
      RUN_DATE,
    );
    expect(plan.summary.stations.updated).toBe(1);
    expect(plan.changes.stations.write).toHaveLength(1);
  });
});

describe('事業者名の一意制約', () => {
  // Phase 3 の突合前に流すと必ず起きる。適用すれば 23505 でトランザクション全体が失敗する
  it('別の既存事業者が同じ name を持っていたら適用不能にする', () => {
    const plan = computeImportPlan(
      records(),
      snapshot({ operators: [{ id: 'op-1', name: '東京メトロ', ekidataCompanyCd: null }] }),
      RUN_DATE,
    );
    expect(plan.blockers).toEqual([
      { code: 'operator_name_conflict', count: 1, samples: ['company_cd=18 name=東京メトロ'] },
    ]);
    expect(plan.changes.operators.write).toEqual([]);
  });

  it('突合済みなら適用不能にならない', () => {
    const plan = computeImportPlan(records(), snapshotMatching(), RUN_DATE);
    expect(plan.blockers).toEqual([]);
  });

  it('自分自身の name との一致は衝突ではない', () => {
    const plan = computeImportPlan(
      records({ operators: [{ ekidataCompanyCd: 18, name: '東京メトロ' }] }),
      snapshotMatching(),
      RUN_DATE,
    );
    expect(plan.blockers).toEqual([]);
    expect(plan.summary.operators.unchanged).toBe(1);
  });
});

describe('駅と路線の関連・隣接', () => {
  it('既にある (駅, 路線) の組は作り直さない', () => {
    const plan = computeImportPlan(records(), snapshotMatching(), RUN_DATE);
    expect(plan.changes.stationLines).toEqual([]);
  });

  it('片方が新規なら組を作る', () => {
    const base = snapshotMatching();
    const plan = computeImportPlan(
      records({ stations: [station(9930101, 1130208, '新宿'), station(9930102, 1130208, '新宿西口')] }),
      base,
      RUN_DATE,
    );
    expect(plan.changes.stationLines).toEqual([
      { ekidataStationCd: 9930102, ekidataLineCd: 99301 },
    ]);
  });

  it('既にある隣接は作り直さない', () => {
    const plan = computeImportPlan(
      records({
        stations: [station(9930101, 1130208, '新宿'), station(9930102, 1130208, '新宿西口')],
        adjacencies: [
          { ekidataLineCd: 99301, ekidataStationCdA: 9930101, ekidataStationCdB: 9930102 },
        ],
      }),
      twoStationSnapshotWithAdjacency(),
      RUN_DATE,
    );
    expect(plan.changes.adjacencies).toEqual([]);
  });

  // join CSV が同じ辺を逆向きで配布し直しても、無向辺として同一視する。
  // unique_station_adjacency は端点の順序に依存するため、ここで弾かないと重複行が入る
  it('端点が入れ替わっただけの既存隣接は作り直さない', () => {
    const plan = computeImportPlan(
      records({
        stations: [station(9930101, 1130208, '新宿'), station(9930102, 1130208, '新宿西口')],
        adjacencies: [
          { ekidataLineCd: 99301, ekidataStationCdA: 9930102, ekidataStationCdB: 9930101 },
        ],
      }),
      twoStationSnapshotWithAdjacency(),
      RUN_DATE,
    );
    expect(plan.changes.adjacencies).toEqual([]);
  });

  it('CSV 内に同じ辺が両向きあっても片方だけ計画する', () => {
    const plan = computeImportPlan(
      records({
        stations: [station(9930101, 1130208, '新宿'), station(9930102, 1130208, '新宿西口')],
        adjacencies: [
          { ekidataLineCd: 99301, ekidataStationCdA: 9930101, ekidataStationCdB: 9930102 },
          { ekidataLineCd: 99301, ekidataStationCdA: 9930102, ekidataStationCdB: 9930101 },
        ],
      }),
      snapshot(),
      RUN_DATE,
    );
    expect(plan.changes.adjacencies).toEqual([
      { ekidataLineCd: 99301, ekidataStationCdA: 9930101, ekidataStationCdB: 9930102 },
    ]);
  });
});

/** 新宿・新宿西口の2駅と、その間の隣接1件が既にある DB の姿 */
function twoStationSnapshotWithAdjacency(): MasterSnapshot {
  const base = snapshotMatching();
  return snapshot({
    ...base,
    stations: [
      ...base.stations,
      {
        id: 'station-2',
        ekidataStationCd: 9930102,
        name: '新宿西口',
        nameKana: 'シンジュクニシグチ',
        lat: '35.690921',
        lon: '139.700258',
        prefCode: 13,
        stationGroupId: 'group-1',
        abolishedAt: null,
      },
    ],
    stationAdjacencyKeys: [{ lineId: 'line-1', stationAId: 'station-1', stationBId: 'station-2' }],
  });
}

describe('乗換接続の上限', () => {
  it('同一グループの現役駅の全順序対を数える', () => {
    const plan = computeImportPlan(
      records({
        stations: [
          station(1, 100, 'A'),
          station(2, 100, 'B'),
          station(3, 100, 'C'),
          station(4, 200, 'D'),
        ],
      }),
      snapshot(),
      RUN_DATE,
    );
    // 3駅グループ = 6組、単独駅 = 0組
    expect(plan.summary.stationConnections.upperBound).toBe(6);
  });
});

describe('警告の引き継ぎ', () => {
  it('パース時の警告をそのまま計画に載せる', () => {
    const warnings = [{ code: 'dangling_station_group' as const, count: 59, samples: ['x'] }];
    const plan = computeImportPlan(records({ warnings }), snapshot(), RUN_DATE);
    expect(plan.warnings).toEqual(warnings);
  });
});
