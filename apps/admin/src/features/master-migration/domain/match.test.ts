import { describe, it, expect } from 'vitest';
import { computeMigrationPlan } from './match';
import type {
  ExistingLineRow,
  ExistingOperatorRow,
  ExistingStationRow,
  MigrationSnapshot,
} from './migrationPlan';
import type {
  ImportedLine,
  ImportedRecords,
  ImportedStation,
} from '@/features/master-import/domain/importedRecords';

// ekidata 側は東京メトロ(18)の丸ノ内線(99301)と銀座線(99302)を既定にする
function records(overrides: Partial<ImportedRecords> = {}): ImportedRecords {
  const base: Omit<ImportedRecords, 'seen'> = {
    operators: [
      { ekidataCompanyCd: 18, name: '東京メトロ' },
      { ekidataCompanyCd: 119, name: '東京都交通局' },
    ],
    lines: [line(99301, '東京メトロ丸ノ内線'), line(99302, '東京メトロ銀座線')],
    stations: [
      ekidataStation(9930101, 99301, '新宿'),
      ekidataStation(9930102, 99301, '四ツ谷'),
      ekidataStation(9930201, 99302, '浅草'),
    ],
    stationGroups: [],
    adjacencies: [],
    closures: { lines: new Map(), stations: new Map() },
    warnings: [],
    ...overrides,
  };
  return {
    ...base,
    seen: {
      lines: new Set(base.lines.map((l) => l.ekidataLineCd)),
      stations: new Set(base.stations.map((s) => s.ekidataStationCd)),
    },
  };
}

function line(cd: number, name: string, companyCd = 18): ImportedLine {
  return { ekidataLineCd: cd, ekidataCompanyCd: companyCd, name, nameKana: null, color: null };
}

function ekidataStation(cd: number, lineCd: number, name: string): ImportedStation {
  return {
    ekidataStationCd: cd,
    ekidataLineCd: lineCd,
    ekidataStationGroupCd: cd,
    name,
    nameKana: null,
    lat: null,
    lon: null,
    prefCode: 13,
  };
}

function operator(overrides: Partial<ExistingOperatorRow> = {}): ExistingOperatorRow {
  return {
    id: 'op-metro',
    name: '東京メトロ',
    odptOperatorId: 'odpt.Operator:TokyoMetro',
    ekidataCompanyCd: null,
    ...overrides,
  };
}

function existingLine(overrides: Partial<ExistingLineRow> = {}): ExistingLineRow {
  return {
    id: 'line-marunouchi',
    name: '東京メトロ丸ノ内線',
    operatorId: 'op-metro',
    ekidataLineCd: null,
    ...overrides,
  };
}

function existingStation(overrides: Partial<ExistingStationRow> = {}): ExistingStationRow {
  return {
    id: 'st-shinjuku',
    name: '新宿',
    ekidataStationCd: null,
    lineIds: ['line-marunouchi'],
    ...overrides,
  };
}

function snapshot(overrides: Partial<MigrationSnapshot> = {}): MigrationSnapshot {
  return {
    operators: [operator()],
    lines: [existingLine()],
    stations: [existingStation()],
    connections: { total: 546, replaceable: 546, withInput: 0 },
    ...overrides,
  };
}

describe('事業者の突合', () => {
  it('odptOperatorId から company_cd を引く', () => {
    const plan = computeMigrationPlan(records(), snapshot());

    expect(plan.operators.assigned).toEqual([{ id: 'op-metro', code: 18, method: 'manual' }]);
    expect(plan.operators.unmatched).toHaveLength(0);
  });

  it('接頭辞の無い odptOperatorId でも引ける', () => {
    const plan = computeMigrationPlan(
      records(),
      snapshot({ operators: [operator({ odptOperatorId: 'TokyoMetro' })] }),
    );

    expect(plan.operators.assigned).toEqual([{ id: 'op-metro', code: 18, method: 'manual' }]);
  });

  it('対応表に無い事業者は削除せず未突合として残す（REQ-3.2）', () => {
    const plan = computeMigrationPlan(
      records(),
      snapshot({
        operators: [operator({ id: 'op-x', name: '架空鉄道', odptOperatorId: 'odpt.Operator:Fake' })],
        lines: [],
        stations: [],
      }),
    );

    expect(plan.operators.assigned).toHaveLength(0);
    expect(plan.operators.unmatched).toMatchObject([{ id: 'op-x', reason: 'operator_not_in_table' }]);
  });

  it('対応表のコードが CSV の現役事業者に無ければ書き込まない', () => {
    const plan = computeMigrationPlan(
      records({ operators: [{ ekidataCompanyCd: 119, name: '東京都交通局' }] }),
      snapshot({ lines: [], stations: [] }),
    );

    expect(plan.operators.unmatched).toMatchObject([{ reason: 'company_not_in_csv' }]);
  });

  it('既にコードが入っている行は触らない（冪等性）', () => {
    const plan = computeMigrationPlan(
      records(),
      snapshot({ operators: [operator({ ekidataCompanyCd: 18 })] }),
    );

    expect(plan.operators.assigned).toHaveLength(0);
    expect(plan.operators.alreadySet).toBe(1);
  });
});

describe('路線の突合', () => {
  it('正規化した名前の完全一致で決める', () => {
    const plan = computeMigrationPlan(records(), snapshot());

    expect(plan.lines.assigned).toEqual([
      { id: 'line-marunouchi', code: 99301, method: 'name' },
    ]);
  });

  it('括弧を除いて一致させる', () => {
    const plan = computeMigrationPlan(
      records(),
      snapshot({ lines: [existingLine({ name: '東京メトロ丸ノ内線(支線)' })], stations: [] }),
    );

    expect(plan.lines.assigned).toMatchObject([{ code: 99301, method: 'name' }]);
  });

  it('名前が一致しなくても、全駅が収まる路線が1つなら決める', () => {
    const plan = computeMigrationPlan(
      records(),
      snapshot({
        lines: [existingLine({ name: '丸ノ内線各駅停車' })],
        stations: [
          existingStation({ id: 'st-1', name: '新宿' }),
          existingStation({ id: 'st-2', name: '四ツ谷' }),
        ],
      }),
    );

    expect(plan.lines.assigned).toMatchObject([{ code: 99301, method: 'station_containment' }]);
  });

  it('全駅が収まる路線が無ければ未突合にし、名前の近い候補を添える', () => {
    const plan = computeMigrationPlan(
      records(),
      snapshot({
        lines: [existingLine({ id: 'line-x', name: '東京メトロ南北線' })],
        stations: [existingStation({ id: 'st-1', name: '目黒', lineIds: ['line-x'] })],
      }),
    );

    expect(plan.lines.assigned).toHaveLength(0);
    expect(plan.lines.unmatched[0]).toMatchObject({ id: 'line-x', reason: 'no_candidate' });
    // 「東京メトロ」を共有するため候補として提示される
    expect(plan.lines.unmatched[0]?.candidates.length).toBeGreaterThan(0);
  });

  it('事業者が未突合なら路線も候補を絞れない', () => {
    const plan = computeMigrationPlan(
      records(),
      snapshot({
        operators: [operator({ odptOperatorId: 'odpt.Operator:Fake' })],
        stations: [],
      }),
    );

    expect(plan.lines.unmatched).toMatchObject([{ reason: 'operator_unresolved' }]);
  });
});

describe('駅の突合', () => {
  it('確定した路線の中から正規化名の完全一致で引く', () => {
    const plan = computeMigrationPlan(records(), snapshot());

    expect(plan.stations.assigned).toEqual([
      { id: 'st-shinjuku', code: 9930101, method: 'name' },
    ]);
  });

  it('ヶ と ケ の揺れを吸収する（REQ-3.3）', () => {
    const plan = computeMigrationPlan(
      records({
        stations: [ekidataStation(9930103, 99301, '市ケ谷')],
      }),
      snapshot({ stations: [existingStation({ name: '市ヶ谷' })] }),
    );

    expect(plan.stations.assigned).toMatchObject([{ code: 9930103 }]);
  });

  it('路線が未突合なら駅も未突合として残す', () => {
    // 駅名も ekidata に無いため全駅包含でも路線が決まらず、路線が未突合のまま残る
    const plan = computeMigrationPlan(
      records(),
      snapshot({
        lines: [existingLine({ name: '存在しない線', id: 'line-z' })],
        stations: [existingStation({ name: '架空駅', lineIds: ['line-z'] })],
      }),
    );

    expect(plan.lines.assigned).toHaveLength(0);
    expect(plan.stations.unmatched).toMatchObject([{ reason: 'line_unresolved' }]);
  });

  it('所属路線を持たない駅は理由を分けて報告する', () => {
    const plan = computeMigrationPlan(
      records(),
      snapshot({ stations: [existingStation({ lineIds: [] })] }),
    );

    expect(plan.stations.unmatched).toMatchObject([{ reason: 'line_unknown' }]);
  });
});

describe('適用不能の検出', () => {
  it('2つの既存路線が同じ line_cd に寄ったら止める', () => {
    const plan = computeMigrationPlan(
      records(),
      snapshot({
        lines: [
          existingLine({ id: 'line-a', name: '東京メトロ丸ノ内線' }),
          existingLine({ id: 'line-b', name: '東京メトロ丸ノ内線（支線）' }),
        ],
        stations: [],
      }),
    );

    expect(plan.blockers).toMatchObject([{ code: 'duplicate_ekidata_code', count: 1 }]);
  });

  it('既に別の行が持っているコードを割り当てようとしたら止める', () => {
    const plan = computeMigrationPlan(
      records(),
      snapshot({
        lines: [
          existingLine({ id: 'line-a', name: '東京メトロ丸ノ内線' }),
          existingLine({ id: 'line-b', name: '別名', ekidataLineCd: 99301 }),
        ],
        stations: [],
      }),
    );

    expect(plan.blockers).toMatchObject([{ code: 'code_taken_by_other_row' }]);
  });

  it('難易度が入力済みの乗換接続があれば止める（TASK-3.5 の前提）', () => {
    const plan = computeMigrationPlan(
      records(),
      snapshot({ connections: { total: 546, replaceable: 545, withInput: 1 } }),
    );

    expect(plan.blockers).toMatchObject([{ code: 'connection_has_input', count: 1 }]);
  });

  it('突合が素直に決まる場合は適用不能が出ない', () => {
    const plan = computeMigrationPlan(records(), snapshot());

    expect(plan.blockers).toEqual([]);
  });
});

describe('冪等性', () => {
  it('一度適用した後の状態を入力にすると、書き込む対象が無くなる', () => {
    const applied = snapshot({
      operators: [operator({ ekidataCompanyCd: 18 })],
      lines: [existingLine({ ekidataLineCd: 99301 })],
      stations: [existingStation({ ekidataStationCd: 9930101 })],
      connections: { total: 0, replaceable: 0, withInput: 0 },
    });

    const plan = computeMigrationPlan(records(), applied);

    expect(plan.operators.assigned).toHaveLength(0);
    expect(plan.lines.assigned).toHaveLength(0);
    expect(plan.stations.assigned).toHaveLength(0);
    expect(plan.blockers).toEqual([]);
  });
});
