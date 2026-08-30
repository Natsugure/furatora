/**
 * TASK-1.1: トランザクション規模の計測（捨てスクリプト・TASK-6.5 で削除する）
 *
 * 約46,500行の一括投入が単一トランザクションで成立するかを測る。
 *
 * 【安全装置】接続先は MEASURE_DATABASE_URL でしか与えられない。未設定なら起動せず、
 * DATABASE_URL と同一の場合も起動しない。.env は一切書き換えないため、
 * 「計測のために .env を差し替えて戻し忘れる」経路が存在しない。
 *
 * 【実行方法】必ず使い捨ての Neon ブランチに対して実行すること。
 *   MEASURE_DATABASE_URL='postgres://...' BATCH_SIZE=1000 RUN_INDEX=0 \
 *     pnpm --filter scripts exec tsx src/measure-tx-scale.ts
 *
 * BATCH_SIZE を変えて比較する場合は、RUN_INDEX も 0 / 1 / 2 と変えること。
 * 実行ごとに独立したコード範囲と UUID を使うため、各回が「新規投入 → 全件更新」の
 * 同じ条件になる。RUN_INDEX を使い回すと、前回の UUID を復元できず FK が壊れる。
 */
import { withTransaction } from '@furatora/database/tx';
import { sql } from 'drizzle-orm';
import {
  operators,
  lines,
  stationGroups,
  stations,
  stationLines,
  stationAdjacencies,
  stationConnections,
} from '@furatora/database/schema';

// design.md の実測値。tasks.md「対象行数」の表と一致させること
const COUNTS = {
  operators: 175,
  lines: 602,
  stationGroups: 8766,
  stations: 10465,
  stationLines: 10465,
  stationAdjacencies: 10189,
  stationConnections: 5876,
} as const;

const TOTAL_ROWS = Object.values(COUNTS).reduce((a, b) => a + b, 0);

// PostgreSQL の bind パラメータ上限は 1文あたり 65535。
// 最も列数の多い stations が約14列のため、4000行/文で 56,000 パラメータとなり上限に迫る
const MAX_SAFE_BATCH = 4000;

const connectionString = process.env.MEASURE_DATABASE_URL;
if (!connectionString) {
  // 「シェルでは echo できるのに、ここでは未定義」になる典型は export 漏れである。
  // zsh/bash の変数は export しない限り子プロセスに渡らない。
  // 見えている環境変数名だけを出して切り分けられるようにする（値は出さない）
  const visible = Object.keys(process.env)
    .filter((k) => /DATABASE|POSTGRES|NEON|PG/i.test(k))
    .sort();
  throw new Error(
    [
      'MEASURE_DATABASE_URL is not defined.',
      '使い捨ての Neon ブランチの接続文字列を指定すること（DATABASE_URL は使わない）。',
      '',
      `このプロセスから見えている関連の環境変数: ${visible.length ? visible.join(', ') : '（なし）'}`,
      '',
      'シェルで echo できるのにここで未定義になる場合は export 漏れである。',
      'コマンド行に前置する形が最も確実:',
      "  MEASURE_DATABASE_URL='postgresql://...' BATCH_SIZE=1000 RUN_INDEX=0 \\",
      '    pnpm --filter scripts exec tsx src/measure-tx-scale.ts',
    ].join('\n'),
  );
}
if (connectionString === process.env.DATABASE_URL) {
  throw new Error(
    'MEASURE_DATABASE_URL が DATABASE_URL と同一である。開発DBに合成データを投入してはならない',
  );
}

// withTransaction（packages/database/src/tx.ts）は DATABASE_URL を見る。
// 本番の書き込み経路そのものを計測したいので関数を複製せず、
// 上のガードを通過した後にプロセス内の値だけを計測用に差し替える。
// .env は書き換えないため、戻し忘れによる事故は起きない
process.env.DATABASE_URL = connectionString;

const BATCH_SIZE = Number(process.env.BATCH_SIZE ?? 1000);
if (!Number.isInteger(BATCH_SIZE) || BATCH_SIZE < 1 || BATCH_SIZE > MAX_SAFE_BATCH) {
  throw new Error(`BATCH_SIZE は 1〜${MAX_SAFE_BATCH} の整数であること (given: ${BATCH_SIZE})`);
}

const RUN_INDEX = Number(process.env.RUN_INDEX ?? 0);
if (!Number.isInteger(RUN_INDEX) || RUN_INDEX < 0 || RUN_INDEX > 9) {
  throw new Error(`RUN_INDEX は 0〜9 の整数であること (given: ${RUN_INDEX})`);
}

// 実行ごとに重ならないコード範囲。既存の実データ（ekidata コードは 7桁以下）とも衝突しない
const companyBase = 900_000 + RUN_INDEX * 1_000;
const lineBase = 9_000_000 + RUN_INDEX * 10_000;
const groupBase = 90_000_000 + RUN_INDEX * 100_000;
const stationBase = 900_000_000 + RUN_INDEX * 100_000;

// UUID はプロセス内で一度だけ生成し、2周とも同じものを使う。
// 2周目は ekidata コードで衝突して UPDATE されるため、DB上の id は1周目のままである。
// 子テーブルの FK がこの id を参照するので、生成し直してはならない
const operatorIds = Array.from({ length: COUNTS.operators }, () => crypto.randomUUID());
const lineIds = Array.from({ length: COUNTS.lines }, () => crypto.randomUUID());
const groupIds = Array.from({ length: COUNTS.stationGroups }, () => crypto.randomUUID());
const stationIds = Array.from({ length: COUNTS.stations }, () => crypto.randomUUID());

/** 実データの平均長に寄せる。行サイズが投入時間に効くため、極端に短い値を使わない */
const pad = (n: number, width: number) => String(n).padStart(width, '0');

const operatorRows = operatorIds.map((id, i) => ({
  id,
  name: `計測事業者${pad(i, 4)}`,
  ekidataCompanyCd: companyBase + i,
  displayPriority: 0,
}));

const lineRows = lineIds.map((id, i) => ({
  id,
  name: `計測本線${pad(i, 4)}`,
  nameKana: `ケイソクホンセン${pad(i, 4)}`,
  nameEn: `Measure Line ${pad(i, 4)}`,
  slug: `measure-line-r${RUN_INDEX}-${pad(i, 5)}`,
  color: '#0066CC',
  displayOrder: i,
  operatorId: operatorIds[i % COUNTS.operators]!,
  ekidataLineCd: lineBase + i,
}));

const groupRows = groupIds.map((id, i) => ({
  id,
  ekidataStationGroupCd: groupBase + i,
  name: `計測乗換駅${pad(i, 5)}`,
  nameKana: `ケイソクノリカエエキ${pad(i, 5)}`,
  prefCode: (i % 47) + 1,
  lat: (35.0 + (i % 1000) / 10000).toFixed(6),
  lon: (139.0 + (i % 1000) / 10000).toFixed(6),
}));

const stationRows = stationIds.map((id, i) => ({
  id,
  name: `計測駅${pad(i, 5)}`,
  nameKana: `ケイソクエキ${pad(i, 5)}`,
  nameEn: `Measure Station ${pad(i, 5)}`,
  slug: `measure-station-r${RUN_INDEX}-${pad(i, 6)}`,
  code: `M${pad(i % 100, 2)}`,
  lat: (35.0 + (i % 1000) / 10000).toFixed(6),
  lon: (139.0 + (i % 1000) / 10000).toFixed(6),
  operatorId: operatorIds[i % COUNTS.operators]!,
  ekidataStationCd: stationBase + i,
  stationGroupId: groupIds[i % COUNTS.stationGroups]!,
  prefCode: (i % 47) + 1,
}));

const stationLineRows = Array.from({ length: COUNTS.stationLines }, (_, i) => ({
  stationId: stationIds[i]!,
  lineId: lineIds[i % COUNTS.lines]!,
  stationOrder: i,
}));

const adjacencyRows = Array.from({ length: COUNTS.stationAdjacencies }, (_, i) => ({
  lineId: lineIds[i % COUNTS.lines]!,
  stationAId: stationIds[i]!,
  stationBId: stationIds[(i + 1) % COUNTS.stations]!,
}));

const connectionRows = Array.from({ length: COUNTS.stationConnections }, (_, i) => ({
  stationId: stationIds[i]!,
  connectedStationId: stationIds[(i + 5000) % COUNTS.stations]!,
  source: 'ekidata_group' as const,
}));

type Timing = { table: string; rows: number; ms: number; statements: number };

async function main() {
  console.log('='.repeat(72));
  console.log(`TASK-1.1 トランザクション規模の計測`);
  console.log(`  BATCH_SIZE = ${BATCH_SIZE} / RUN_INDEX = ${RUN_INDEX}`);
  console.log(`  対象行数   = ${TOTAL_ROWS.toLocaleString()}`);
  console.log('='.repeat(72));

  // --- サーバ側の制限値を記録する（tasks.md の表と突き合わせる） ---
  const settings = await withTransaction((tx) =>
    tx.execute(sql`
      SELECT name, setting, unit FROM pg_settings
      WHERE name IN ('statement_timeout', 'idle_in_transaction_session_timeout',
                     'idle_session_timeout', 'max_connections')
      ORDER BY name
    `),
  );
  console.log('\n[server settings]');
  for (const row of settings.rows) {
    console.log(`  ${row.name} = ${row.setting}${row.unit ? ` ${row.unit}` : ''}`);
  }

  for (const pass of [1, 2] as const) {
    const label = pass === 1 ? '1周目（全件 INSERT）' : '2周目（全件 UPDATE = 定常状態）';
    console.log(`\n${'-'.repeat(72)}\n${label}\n${'-'.repeat(72)}`);

    const timings: Timing[] = [];
    const wallStart = performance.now();
    let insideTotal = 0;
    let failure: unknown = null;

    try {
      await withTransaction(async (tx) => {
        /** FK の依存順に投入する。順序を入れ替えてはならない */
        const step = async <T>(
          table: string,
          rows: T[],
          apply: (batch: T[]) => Promise<unknown>,
        ) => {
          const start = performance.now();
          let statements = 0;
          for (let i = 0; i < rows.length; i += BATCH_SIZE) {
            await apply(rows.slice(i, i + BATCH_SIZE));
            statements++;
          }
          const ms = performance.now() - start;
          insideTotal += ms;
          timings.push({ table, rows: rows.length, ms, statements });
          console.log(
            `  ${table.padEnd(22)} ${String(rows.length).padStart(6)} rows  ` +
              `${ms.toFixed(0).padStart(7)} ms  ${String(statements).padStart(4)} stmt  ` +
              `${Math.round(rows.length / (ms / 1000)).toLocaleString()} rows/s`,
          );
        };

        await step('operators', operatorRows, (b) =>
          tx.insert(operators).values(b).onConflictDoUpdate({
            target: operators.ekidataCompanyCd,
            set: { name: sql`EXCLUDED.name` },
          }),
        );

        await step('lines', lineRows, (b) =>
          tx.insert(lines).values(b).onConflictDoUpdate({
            target: lines.ekidataLineCd,
            set: { name: sql`EXCLUDED.name`, updatedAt: new Date() },
          }),
        );

        await step('stationGroups', groupRows, (b) =>
          tx.insert(stationGroups).values(b).onConflictDoUpdate({
            target: stationGroups.ekidataStationGroupCd,
            set: { name: sql`EXCLUDED.name`, updatedAt: new Date() },
          }),
        );

        await step('stations', stationRows, (b) =>
          tx.insert(stations).values(b).onConflictDoUpdate({
            target: stations.ekidataStationCd,
            set: { name: sql`EXCLUDED.name`, updatedAt: new Date() },
          }),
        );

        await step('stationLines', stationLineRows, (b) =>
          tx.insert(stationLines).values(b).onConflictDoUpdate({
            target: [stationLines.stationId, stationLines.lineId],
            set: { stationOrder: sql`EXCLUDED.station_order` },
          }),
        );

        await step('stationAdjacencies', adjacencyRows, (b) =>
          tx.insert(stationAdjacencies).values(b).onConflictDoNothing(),
        );

        await step('stationConnections', connectionRows, (b) =>
          tx.insert(stationConnections).values(b).onConflictDoNothing(),
        );
      });
    } catch (error) {
      failure = error;
    }

    const wallMs = performance.now() - wallStart;

    if (failure) {
      const e = failure as { code?: string; message?: string; name?: string };
      console.log(`\n  ❌ 失敗 (${wallMs.toFixed(0)} ms 経過)`);
      console.log(`     name    : ${e.name ?? '-'}`);
      console.log(`     code    : ${e.code ?? '-'}`);
      console.log(`     message : ${e.message ?? String(failure)}`);
      console.log(
        '\n  → タイムアウト(57014 / 25P03)か接続断(ECONNRESET 等)かで対処が変わる。' +
          '\n    tasks.md TASK-1.1「判定基準」に従い、テーブル単位の分割コミットへ倒すこと',
      );
      process.exitCode = 1;
      return;
    }

    const totalStatements = timings.reduce((a, t) => a + t.statements, 0);
    console.log(
      `\n  合計 ${TOTAL_ROWS.toLocaleString()} rows / ${totalStatements} statements`,
    );
    console.log(`  コールバック内の合計   : ${insideTotal.toFixed(0)} ms`);
    console.log(`  withTransaction 全体   : ${wallMs.toFixed(0)} ms`);
    console.log(
      `  差分（接続+BEGIN+COMMIT）: ${(wallMs - insideTotal).toFixed(0)} ms`,
    );
    console.log(`  平均 1文あたり          : ${(insideTotal / totalStatements).toFixed(1)} ms`);
    console.log(
      '\n  ※ 平均1文あたりが数十msで頭打ちなら、支配要因はDBではなく往復遅延である。' +
        '\n    その場合は BATCH_SIZE を上げることで全体時間が比例して縮む',
    );
  }

  console.log(
    '\n判定基準は tasks.md TASK-1.1「判定基準（計測前に確定させる）」を参照すること。' +
      '\n制限値は idle_in_transaction_session_timeout = 300,000ms（文と文の間にのみ効く）。',
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
