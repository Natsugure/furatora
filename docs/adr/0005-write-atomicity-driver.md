# ADR-0005: 書き込みの原子性を担保するため、読み取りと書き込みで Neon のドライバを使い分ける

- **ステータス**: Proposed
- **日付**: 2026-08-15
- **決定者**: @Natsugure
- **関連**: [ADR-0003](./0003-read-write-separation.md), [ADR-0004](./0004-neon-branch-dev-environment.md)

---

## コンテキストと課題

[ADR-0003](./0003-read-write-separation.md) は Repository の存在理由を
**「不変条件を守って永続化する」**と定義した。
[ADR-0004](./0004-neon-branch-dev-environment.md) は開発・CI・本番の接続先を Neon に統一した。

残る問題は、**その原子性を実際にどう担保するか**である。

### 問題1: 本番ドライバがトランザクションを持たない

```
drizzle-orm@0.45.1 / neon-http/session.cjs:177
  async transaction(_transaction, _config = {}) {
    throw new Error("No transactions support in neon-http driver");
```

`packages/database/src/client.ts` の既定ドライバは `drizzle-orm/neon-http` である。
**`db.transaction()` は実行時例外になる。**
Repository を導入しても、この上では不変条件を守れない。
むしろ「Repository が守っている」という誤った安心感を生む分、現状より危険である。

### 問題2: 既存の複数テーブル書き込みが非原子的である

```ts
// apps/admin/src/app/api/stations/[stationId]/platform-locations/[locationId]/route.ts
await db.delete(stationFacilities)...        // :41
await db.delete(platformLocationCells)...    // :45
await db.insert(stationFacilities)...        // :57
await db.delete(facilityConnections)...      // :70
await db.insert(facilityConnections)...      // :72
```

3テーブルへの delete → insert がトランザクション無しで実行されている。
途中で失敗すると、設備が削除されたまま復元されない。
リポジトリ全体で `db.transaction` / `db.batch` の使用箇所は
`apps/scripts/src/update-odpt.ts` の1箇所のみである。

### 問題3: Issue #29 が新たに親子構造の書き込みを追加する

`docs/spec/design.md` の新テーブルは親子関係にある。

```ts
trainStopPatterns     { id: uuid().default(sql`uuid_generate_v7()`), platformId, trainId }
trainStopPatternCars  { id, trainStopPatternId → trainStopPatterns.id, carNumber, startMeters, endMeters }
```

親の `id` は **DB側で採番される**ため、
「親を insert → 返却された id を使って子を insert」という順序が必須になる。
**この形は `db.batch()` では表現できない**（batch は静的なクエリ配列であり、
前段の結果を後段に渡せない）。対話的トランザクションが要る。

### 問題4: 現状の回避策がフラグ名に隠れている

`.github/workflows/update-odpt.yml` は本番の `DATABASE_URL` に対して
`USE_LOCAL_DB: 'true'` を設定している。`update-odpt.ts:151` の
`db.transaction()` を通すためであり、実態は
**「postgres-js ドライバを使う」フラグ**である
（詳細は [ADR-0004](./0004-neon-branch-dev-environment.md) の問題2）。

この行を消すと日次のODPT更新が壊れる。
**本ADRの決定は、この回避策の正式な置き換えでもある。**

---

## 検討した選択肢

| | 内容 | トランザクション | 親子insert |
|---|---|---|---|
| **1** | `neon-http` のまま `db.batch()` で妥協 | ❌ | ❌ |
| **2** | 全アプリを `neon-serverless`（WebSocket）に統一 | ✅ | ✅ |
| **3** | 読み取り=`neon-http` / 書き込み=`neon-serverless` | ✅ | ✅ |

`@neondatabase/serverless@1.0.2`（**インストール済み**）は
`neon()`（HTTP）と `Pool`（WebSocket）の両方を export しており、
いずれの選択肢でも新規依存は発生しない。

---

## 決定

**選択肢3を採用する。**

抽象を分ける軸は [ADR-0003](./0003-read-write-separation.md) と同一の
**「読み取り / 書き込み」**とし、ドライバの選択をその軸から導出する。

```
                  読み取り                   書き込み
              ┌────────────────────┬──────────────────────────┐
  抽象        │ Query Service       │ Repository               │  ← ADR-0003
  ドライバ    │ neon-http           │ neon-serverless（ws Pool）│  ← 本ADR
  接続        │ 1クエリ1往復・接続なし│ BEGIN / COMMIT           │
              └────────────────────┴──────────────────────────┘
```

**新しい判断軸を増やさない。** 「Query Service を書くなら `db`、
Repository を書くなら `withTransaction`」という機械的な対応になる。

### 実装

`packages/database` は用途別に2つのエントリを export する。

```ts
// packages/database/src/client.ts — 読み取り用（既存の import パスを維持する）
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not defined');
}

export const db = drizzle({ client: neon(connectionString), schema });
```

```ts
// packages/database/src/tx.ts — 書き込み用（新規）
import { Pool } from '@neondatabase/serverless';
import { drizzle, type NeonDatabase } from 'drizzle-orm/neon-serverless';
import * as schema from './schema';

type TxCallback = Parameters<NeonDatabase<typeof schema>['transaction']>[0];
export type Tx = Parameters<TxCallback>[0];

export async function withTransaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not defined');
  }

  const pool = new Pool({ connectionString });
  try {
    return await drizzle(pool, { schema }).transaction(fn);
  } finally {
    await pool.end();
  }
}
```

`package.json` の `exports` に `"./tx": "./src/tx.ts"` を追加する。

> 上記の型抽出（`Tx`）と、親のIDを受けて子を insert する形が
> 実際に型検査を通ることは、`drizzle-orm@0.45.1` /
> `@neondatabase/serverless@1.0.2` の実環境で確認済み（2026-08-15）。

#### 追記（2026-08-15・実装時に判明）: CI の Node.js バージョンに `WebSocket` グローバルが必要

`neon-serverless` の `Pool` は接続に `WebSocket` を使う。Node.js は v22 以降で
グローバル `WebSocket` を標準搭載するが、`.github/workflows/update-odpt.yml` の
CI 実行環境が `node-version: 20` だったため、`workflow_dispatch` での実行時に
`fetch failed`（WebSocket接続失敗）で落ちた（ローカルの Node v24.18.0 は
グローバル `WebSocket` を持つため、ローカル確認では気づけなかった）。

`@neondatabase/serverless` の `CONFIG.md` は `neonConfig.webSocketConstructor`
（`ws` パッケージ）による明示的な差し替えも提示しているが、これは
「`WebSocket` グローバルが無い環境向け」の条件付きの選択肢であり、
Node.js だからといって恒久的に必要というわけではない
（[`CONFIG.md`](https://github.com/neondatabase/serverless/blob/main/CONFIG.md#websocketconstructor-typeof-websocket--undefined)）。

Node 20 は 2026年4月に EOL を迎える（本ADR作成時点で運用継続の根拠が薄い）ため、
本Issueでは `ws` を追加せず、**CI の `node-version` を `24` に上げることで解決する**。
ローカル開発環境（Node v24.18.0）と実行環境が揃うことで、
今回のような「ローカルでは動くがCIでは動かない」バージョン差異の再発も防げる。

#### 追記（2026-08-21・レビューで判明）: CI だけでなく本番実行環境も固定が必要

上記の追記は CI（`update-odpt.yml`）のみを対象としていたが、`withTransaction` は
その後 `apps/admin` の全書き込み経路（停車位置パターンの作成・更新、
ホーム位置の作成・更新・複製）で使われるようになった。
すなわち Node.js のバージョン制約は **本番実行環境にも及ぶ**。

リポジトリ側にバージョンを表明する記述が無かったため、
`package.json` の `engines.node` に `>=22` を追加した（ルート・`packages/database`・
`apps/admin`）。ただし `engines` はインストール時の検査であり、
**デプロイ先のランタイム選択を強制するものではない**。
Vercel 側の Node.js バージョン設定が v22 未満のままだと、
読み取り（neon-http）は成功し書き込みだけが `fetch failed` で落ちるため、
プロジェクト設定側でも v22 以上を明示すること。

使用例:

```ts
// external/repository/stopPatternRepository.ts
import { withTransaction } from '@furatora/database/tx';

export const dbStopPatternRepository: StopPatternRepository = {
  async save(pattern) {
    await withTransaction(async (tx) => {
      const [row] = await tx.insert(trainStopPatterns).values({ ... }).returning();
      await tx.insert(trainStopPatternCars).values(
        pattern.cars.map((c) => ({ trainStopPatternId: row!.id, ...c })),
      );
    });
  },
};
```

### Pool はリクエストごとに作成し、必ず閉じる

`withTransaction` は毎回 `Pool` を生成し `finally` で `end()` する。
サーバーレス環境ではモジュールレベルで Pool を保持すると、
関数インスタンスをまたいで接続が滞留するためである。

`apps/admin` は管理用ツールでアクセス頻度が低く、
WebSocket の接続確立コストは許容できる。
`apps/web` は書き込みを持たないため、この経路を通らない。

### `USE_LOCAL_DB` の廃止手順

[ADR-0004](./0004-neon-branch-dev-environment.md) の通り、
このフラグは現在 load-bearing である。以下の順序で行う。

1. `packages/database/src/tx.ts` を追加する
2. `apps/scripts/src/update-odpt.ts:151` の `db.transaction()` を `withTransaction()` に置き換える
3. `.github/workflows/update-odpt.yml` から `USE_LOCAL_DB: 'true'` を削除する
4. `client.ts` の `USE_LOCAL_DB` 分岐と `postgres` 依存を削除する
5. **手動で `workflow_dispatch` を実行し、成功することを確認する**

手順5を省略しないこと。ODPT更新は日次cronであり、
壊れていても翌日まで気づけない。

---

## 各選択肢の評価

### 選択肢1: `neon-http` のまま `db.batch()` で妥協

- **良い点**: ドライバが1つのままで、変更が最小
- **悪い点**:
  - **Issue #29 の親子 insert を表現できない**（問題3）。
    batch は静的なクエリ配列であり、親の採番IDを子に渡せない
  - [ADR-0003](./0003-read-write-separation.md) の Repository の存在理由
    （不変条件を守る）が成立しない
- **却下理由**: 目前の Issue #29 で既に不足する

### 選択肢2: 全アプリを `neon-serverless` に統一

- **良い点**: ドライバが1つで、どちらを使うか迷わない
- **悪い点**:
  - `apps/web` は**書き込みを一切持たない**公開閲覧アプリであり、
    読み取りのために WebSocket の接続確立コストを払う理由が無い。
    Neon は一発読みに HTTP を推奨している
  - `apps/web` は `stations/[slug]/page.tsx` で10クエリを発行する。
    最も性能が効く経路で不利な選択になる
- **却下理由**: 読み取り主体のアプリに書き込み向けの構成を強制する

### 選択肢3: 読み取り / 書き込みで使い分ける（採用）

- **良い点**:
  - 読み取り経路は `neon-http` のまま変わらず、既存の import を書き換えずに済む
  - 書き込み経路で本物の `BEGIN` / `COMMIT` が使え、Repository の前提が成立する
  - **選択の軸が [ADR-0003](./0003-read-write-separation.md) と同一**であり、
    新しい判断基準を増やさない
  - `USE_LOCAL_DB` という実態を偽ったフラグを、
    用途が明示された `withTransaction` に置き換えられる
- **悪い点**:
  - クライアントが2つになる。どちらを import するかの判断が要る
    （ただし ADR-0003 の抽象の種別と1対1に対応する）
  - 書き込みごとに WebSocket の接続確立が発生する

---

## 結果

### 肯定的な結果

- `platform-locations/[locationId]/route.ts` の3テーブル非原子書き込みを原子化できる
- Issue #29 の `trainStopPatterns` → `trainStopPatternCars` の親子 insert が実装可能になる
- [ADR-0003](./0003-read-write-separation.md) の Repository が、
  名目ではなく実際に不変条件を守れるようになる
- `USE_LOCAL_DB` が消え、[ADR-0002](./0002-dependency-inversion-ports.md) の注記で指摘した
  `client.ts` の `import postgres from 'postgres'` も同時に消える

### 否定的な結果・受け入れるトレードオフ

- **書き込みのレイテンシが増える。** WebSocket の接続確立と `BEGIN` / `COMMIT` の往復が加わる。
  `apps/admin` は管理用ツールであり、これを許容する
- **読み取り専用のトランザクションは張れない。** 複数クエリ間の読み取り一貫性が必要な
  Query Service が現れた場合は、本ADRの見直し対象とする
- クライアントが2つに増える

### 適用範囲

- **`withTransaction` の適用**: `apps/admin` の複数テーブル書き込み、および `apps/scripts`
- **Issue #29 での必須対応**: `stop-pattern`（親子 insert のため）と `USE_LOCAL_DB` の廃止手順
- **単一テーブルの単純な書き込み**（`operators` / `lines` / `facility-types` 等）は
  `withTransaction` を使わず `db` のままでよい。
  トランザクションを要するのは、複数テーブルにまたがるか不変条件がある場合に限る
- `platform-locations` 系の既存ルートの原子化は、Issue #29 の範囲で行う
  （既に非原子であり、#29 で同じ箇所を触るため）

### 見直し条件

- Neon が `neon-http` にトランザクションを追加したとき（選択肢2の再評価）
- 読み取り一貫性のためにトランザクションが必要な Query Service が現れたとき
- `apps/admin` の書き込みレイテンシが実用上の問題になったとき
  （モジュールレベルでの Pool 保持、または Neon の接続プーラの利用を検討する）
- PostgreSQL 18 へ移行し `pg_uuidv7` が不要になったとき
  （主キーの採番方法が変わり、親子 insert の制約が変化する可能性がある）
