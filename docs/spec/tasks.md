# 実装タスク: ホーム設備・車両停車位置のメートル座標化 (Issue #29 拡張)

## 概要

- **対象**: `packages/database`, `packages/eslint-config`(新規), `apps/admin`, `apps/web`, `apps/scripts`
- **参照**: [`requirements.md`](./requirements.md) / [`design.md`](./design.md) / [ADR一覧](../adr/README.md)
- **作成日**: 2026-08-14
- **最終更新**: 2026-08-15（ADR-0001〜0005 の決定を反映 / レビュー指摘 1〜4 を反映 /
  TASK-0.5.1 を `.env` 実態調査の結果で全面改訂）
- **ブランチ**: `feature/issue29-platform-improve`
- **信頼度**: 72%（中）→ MVP検証を先行させる（詳細は `design.md` の「適応的実行戦略」参照）

---

## フェーズ構成

```
Phase 0:   docs/spec・ADR作成                  (完了)
Phase 0.5: 開発環境・DBドライバ移行            (ADR-0004/0005・最優先)
Phase 1:   スキーマ変更                        (基盤)
Phase 2:   既存データのリセット                 (必須。TASK-2.4 のみ Phase 4 の後)
Phase 2.5: アーキテクチャ基盤                  (ADR-0001/0002・Phase 3以降の前提)
Phase 3:   Admin API更新 + features層移行      (P0。TASK-3.6 は既存ページの追随)
Phase 4:   Admin UI更新                        (P0)
Phase 5:   Web features層構築 + UI更新         (P1)
Phase 6:   検証・振り返り                       (必須)
```

### なぜ Phase 0.5 が最初か

`trainStopPatterns` → `trainStopPatternCars` の親子 insert には
対話的トランザクションが必須だが、既定の `neon-http` ドライバは
`db.transaction()` が**実行時例外**になる（[ADR-0005](../adr/0005-write-atomicity-driver.md)）。
Phase 3.5 の実装が Phase 0.5 に依存するため、先に片付ける。

また `USE_LOCAL_DB` は現在 **load-bearing** であり、
単独で消すと本番の日次ODPT更新が壊れる。削除順序を厳守すること。

---

## Phase 0: docs/spec・ADR作成（完了）

### TASK-0.1: requirements.md 更新
- **状態**: ✅ 完了 (2026-08-14)

### TASK-0.2: design.md 更新
- **状態**: ✅ 完了 (2026-08-15・ADR反映済み)

### TASK-0.3: tasks.md 更新
- **状態**: ✅ 完了 (2026-08-15・ADR反映済み)

### TASK-0.4: ADR-0001〜0005 作成
- **状態**: ✅ 完了 (2026-08-15)
- **成果物**: `docs/adr/` 配下5本 + README。全て `Proposed`

---

## Phase 0.5: 開発環境・DBドライバ移行

参照: [ADR-0004](../adr/0004-neon-branch-dev-environment.md) / [ADR-0005](../adr/0005-write-atomicity-driver.md)

> **⚠️ TASK-0.5.2 〜 0.5.5 は同一PRで行うこと。**
> 途中で分割すると `update-odpt` が本番で壊れる。

### TASK-0.5.1: Neon に `development` ブランチを作成し、`.env` を4ファイルに整理する
- **実装内容**:
  1. Neon コンソール（または Neon CLI / MCP）で `main` から `development` ブランチを作成
  2. `.env` を**下表の4ファイルだけ**に整理する

     | ファイル | 読む主体 | `DATABASE_URL` | 同居させる変数 |
     |---|---|---|---|
     | `apps/web/.env.local` | Next.js | **プールド**（`-pooler` 付き） | `NEXT_PUBLIC_GA_ID` |
     | `apps/admin/.env.local` | Next.js | **プールド** | `AUTH_*`, `GEMINI_API_KEY` |
     | `apps/scripts/.env` | `dotenv/config`（TASK-0.5.4 以降は `--env-file-if-exists`） | **直結**（`-pooler` 無し） | `ODPT_API_KEY` |
     | `packages/database/.env` | `dotenv/config`（`drizzle.config.ts`） | **直結** | — |

  3. 上記以外の `.env` 系ファイルを削除する:
     `.env`（ルート）, `.env.local`（ルート）, `apps/web/.env`,
     `apps/scripts/.env.local`, `packages/database/.env.local`
  4. ルート `.env.local` の削除に伴い、`package.json` の `dev` / `build` から
     `pnpm dotenv -e .env.local --` を外す（`fix-dev-migrations` は TASK-0.5.4 で対応、
     `migrate-platform-locations` は TASK-2.1 で削除）
- **期待結果**: Web・Admin・スクリプト・drizzle-kit のすべてが Neon の
  `development` ブランチに接続し、`DATABASE_URL` の定義箇所が用途ごとに1つずつになる
- **依存**: なし
- **注意**:
  - **`.env.local` を読むのは Next.js だけである。** `dotenv`（`packages/database`）も
    Node の `--env-file`（TASK-0.5.4）も `.env` しか読まない。
    そのため Next.js アプリは `.env.local`、それ以外は `.env` に統一する
  - **`apps/web` / `apps/admin` を忘れないこと。** この2つが Web・Admin の接続先を
    決めている。漏らすと「Admin で入力したデータが Web に出てこない」状態になる
  - **4ファイルすべてが同じエンドポイントID（`ep-...`）を指すことを確認する。**
    `main` のIDと取り違えると**本番ブランチにテストデータを流し込む事故**になる。
    `development` ブランチのIDは Neon コンソールの Branches → development で確認する
  - **プールド／直結を取り違えないこと**（判断根拠は下記）
- **参照**: プールド／直結の使い分け

  | 用途 | 接続 | 理由 |
  |---|---|---|
  | Next.js（`neon-http`、リクエストごとの接続） | プールド | PgBouncer が効く典型ケース |
  | drizzle-kit（`db:push` / `db:generate` / `db:studio`） | 直結 | プールドは PgBouncer の **transaction モード**でセッション状態が残らない。`drizzle.config.ts` が渡す `options=-c search_path=public` が効かず、`relation "..." does not exist` など**無関係に見えるエラー**で落ちる |
  | `update-odpt`（`withTransaction` = `Pool`） | 直結 | 長めのトランザクションはどのみち接続を1本占有するため、プーラを挟む利点が無い |

### TASK-0.5.2: `packages/database/src/tx.ts` を新規作成
- **対象ファイル**: `packages/database/src/tx.ts`（新規）, `packages/database/package.json`
- **実装内容**:
  - `design.md`「書き込みの原子性」の `withTransaction` を実装
  - `Pool` はリクエストごとに生成し `finally` で `end()` する
  - `package.json` の `exports` に `"./tx": "./src/tx.ts"` を追加
- **期待結果**: `import { withTransaction } from '@furatora/database/tx'` が使える
- **依存**: なし

### TASK-0.5.3: `update-odpt.ts` を `withTransaction` へ移行
- **対象ファイル**: `apps/scripts/src/update-odpt.ts`（151行目付近）
- **実装内容**: `db.transaction()` を `withTransaction()` に置き換える
- **期待結果**: `neon-http` 依存が外れ、`USE_LOCAL_DB` 無しで動作する
- **依存**: TASK-0.5.2

### TASK-0.5.4: `USE_LOCAL_DB` を廃止し、`.env` 読み込みを `apps/scripts` に移す
- **対象ファイル**:
  - `.github/workflows/update-odpt.yml`（`USE_LOCAL_DB: 'true'` を削除）
  - `apps/scripts/package.json`（**先に**行う。下記参照）
  - `packages/database/src/client.ts`（三項分岐・`postgres`・`dotenv/config` を削除し `neon-http` 固定に）
  - `packages/database/package.json`（`postgres` を削除、`dotenv` を `devDependencies` へ移動）
  - `package.json`（ルート。`postgres` と `dotenv-cli` を devDependencies から削除）
  - `apps/web/package.json`（`dotenv` を削除）
  - **`.env` 4ファイルすべて**（`USE_LOCAL_DB` の行を削除。TASK-0.5.1 の表を参照）
- **実装内容**（この順序で行う）:
  1. `.github/workflows/update-odpt.yml` から `USE_LOCAL_DB: 'true'` を削除する
  2. `apps/scripts/package.json` の3スクリプトに `--env-file-if-exists=.env` を付ける

     ```json
     "update-odpt": "tsx --env-file-if-exists=.env src/update-odpt.ts",
     "seed": "tsx --env-file-if-exists=.env src/seed-master-data.ts",
     "fix-dev-migrations": "tsx --env-file-if-exists=.env src/fix-dev-migrations.ts"
     ```

  3. `client.ts` から `USE_LOCAL_DB` 分岐・`import postgres from 'postgres'`・
     `import 'dotenv/config'` を削除する
  4. `packages/database/package.json` から `postgres`（devDependencies）を削除し、
     `dotenv` を dependencies → devDependencies へ移す
  5. `.env` 4ファイルから `USE_LOCAL_DB` の行を削除する
  6. ルート `package.json` から `postgres` / `dotenv-cli`、`apps/web/package.json` から
     `dotenv` を削除する（いずれも手順3で参照元が消えるため。`apps/web` の `dotenv` は
     `client.ts` の `import 'dotenv/config'` がバンドルに引き込まれていた間接依存）
- **期待結果**: `client.ts` が `neon-http` 固定になり、`postgres` と `dotenv` への依存が消える。
  ローカルの `pnpm run update-odpt` は従来通り `.env` を読む
- **依存**: TASK-0.5.3
- **注意**:
  - **必ず TASK-0.5.3 の後**。順序を逆にすると本番のODPT更新が停止する
  - TASK-0.5.1 完了直後は `USE_LOCAL_DB=true` のまま `DATABASE_URL` が Neon を指すため、
    `client.ts` は **`postgres-js` で Neon に接続する**（TCP接続なので動作はする）。
    `db.transaction()` が壊れていないのはこのためであり、
    手順3で分岐を消した瞬間に `neon-http` へ切り替わって壊れる
  - **手順2を手順3より先に行う。** 逆順にすると、その間ローカルのスクリプトが
    `DATABASE_URL` を読めなくなる
  - **`--env-file`（`-if-exists` 無し）は使用禁止。** `.env` が無いと `exit 9` で即死する。
    GitHub Actions には `.env` が無いため、CIで `update-odpt` が落ちる
  - `dotenv` は削除できない。`packages/database/drizzle.config.ts` が
    `db:generate` / `db:push` / `db:studio` で使っている
  - `apps/web` / `apps/admin` は Next.js が `.env` を読むため対応不要

### TASK-0.5.5: Docker 構成を削除し、`.env.example` を追加
- **対象ファイル**: `docker/Dockerfile.postgres`, `docker/init.sql`, `docker-compose.yml`（すべて削除）,
  `README.md`, `.env.example`（新規）, `.gitignore`
- **実装内容**:
  - 上記3ファイルを削除
  - `README.md` の `docker compose up -d` 手順を Neon ブランチ接続手順へ差し替え
    （**日本語・英語の両セクション**）
  - データ再構築手順（`development` ブランチ再作成 → `db:push` → `seed-master-data` → `update-odpt`）を追記
  - `.env.example` を新規作成する。TASK-0.5.1 の4ファイル表をそのまま反映し、
    **どのファイルがプールドでどれが直結か**を値ではなくコメントで示す
  - `.gitignore` の `.env*` の後に `!.env.example` を追加する（**これが無いと追跡されない**）
- **期待結果**: `pg_uuidv7` ビルド用の Dockerfile 維持が不要になる（Neonが標準サポート）。
  新規clone時に必要な環境変数と、その配置先・プールド／直結の区別がリポジトリ内で自己完結する
- **依存**: TASK-0.5.1

### TASK-0.5.6: `update-odpt` の疎通をローカル・CIの両方で確認
- **実装内容**:
  1. **ローカル**で `pnpm run update-odpt` を実行し、成功を確認する（`.env` 読み込みの検証）
  2. GitHub Actions の `update-odpt` を `workflow_dispatch` で手動実行し、成功を確認する
- **期待結果**: `withTransaction` 経由で書き込みが成功し、`.env` 経由・環境変数経由の
  どちらでも `DATABASE_URL` を解決できる
- **依存**: TASK-0.5.4
- **注意**: **どちらも省略禁止。**
  - ODPT更新は日次cronのため、壊れていても翌日まで気づけない
  - **CIは環境変数を直接注入するため、`.env` の読み込みが壊れていても手順2は成功する。**
    手順1を省くと、ローカルだけが壊れた状態が次に誰かが手元で回すまで露見しない
- **実施結果**（2026-08-15）: 手順1はローカル（Node v24.18.0）で成功。手順2は初回、
  CIの `node-version: 20` にグローバル `WebSocket` が無く `withTransaction`
  （`neon-serverless` の `Pool`）が接続失敗した。CIの `node-version` を `24` に
  引き上げ（Node 20はEOLが近いため）、ローカルと環境を揃えて再実行し成功を確認した
  （[ADR-0005](../adr/0005-write-atomicity-driver.md) 追記参照）

---

## Phase 1: スキーマ変更

### TASK-1.1: `platforms` テーブルの `maxCarCount` を `physicalLength` に置き換え
- **対象ファイル**: `packages/database/src/schema.ts`
- **実装内容**:
  - `maxCarCount: integer('max_car_count').notNull()` を削除
  - `physicalLength: decimal('physical_length', { precision: 6, scale: 2 }).notNull().default('0')` を追加
- **期待結果**: `platforms` テーブルが号車数ではなくメートル単位の物理長を持つ
- **依存**: なし
- **注意**: **`default('0')` を省略しない。** `platforms` には既存行があり、
  `notNull` かつ default 無しのカラムは追加できない。また `maxCarCount`（号車数）から
  `physicalLength`（メートル）への機械的変換は不可能（1両の長さが列車ごとに異なるため）。
  `'0'` は「未入力」を意味する暫定値であり、Web側は `physicalLength === 0` のホームを
  描画対象から除外する。`default` を外す作業は後続Issue
  （`design.md`「移行方針 → `platforms.physicalLength` を `notNull` にする手順」参照）

### TASK-1.2: `platformCarStopPositions` テーブルを削除
- **対象ファイル**: `packages/database/src/schema.ts`
- **実装内容**: `platformCarStopPositions` テーブル定義および `CarStopPosition` 型を削除する
- **期待結果**: 号車基準の停車位置テーブルが存在しなくなる
- **依存**: なし

### TASK-1.3: `trainStopPatterns` テーブルを新規追加
- **対象ファイル**: `packages/database/src/schema.ts`
- **実装内容**:
  ```typescript
  export const trainStopPatterns = pgTable('train_stop_patterns', {
    id: uuid('id').primaryKey().default(sql`uuid_generate_v7()`),
    platformId: uuid('platform_id').references(() => platforms.id, { onDelete: 'cascade' }).notNull(),
    trainId: uuid('train_id').references(() => trains.id, { onDelete: 'cascade' }).notNull(),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()),
  }, (t) => [
    unique('unique_train_stop_pattern').on(t.platformId, t.trainId),
  ]);
  ```
- **期待結果**: ホーム・列車の組み合わせごとに1つの停車位置パターンを持てる
- **依存**: なし

### TASK-1.4: `trainStopPatternCars` テーブルを新規追加
- **対象ファイル**: `packages/database/src/schema.ts`
- **実装内容**:
  ```typescript
  export const trainStopPatternCars = pgTable('train_stop_pattern_cars', {
    id: uuid('id').primaryKey().default(sql`uuid_generate_v7()`),
    trainStopPatternId: uuid('train_stop_pattern_id')
      .references(() => trainStopPatterns.id, { onDelete: 'cascade' })
      .notNull(),
    carNumber: integer('car_number').notNull(),
    startMeters: decimal('start_meters', { precision: 6, scale: 2 }).notNull(),
    endMeters: decimal('end_meters', { precision: 6, scale: 2 }).notNull(),
  }, (t) => [
    unique('unique_train_stop_pattern_car').on(t.trainStopPatternId, t.carNumber),
  ]);
  ```
- **期待結果**: 号車ごとの開始・終了位置（メートル）を保持できる
- **依存**: TASK-1.3

### TASK-1.5: `trainCarStructures` に `carLength` を追加
- **対象ファイル**: `packages/database/src/schema.ts`
- **実装内容**: `trainCarStructures` に `carLength: decimal('car_length', { precision: 5, scale: 2 })`（nullable）を追加
- **期待結果**: 号車ごとの実長を任意で保持できる。未指定時はアプリ側で標準値（20.0m）を使う
- **依存**: なし

### TASK-1.6: `trains` から `limitedToPlatformIds` を削除
- **対象ファイル**: `packages/database/src/schema.ts`
- **実装内容**: `limitedToPlatformIds: uuid('limited_to_platform_ids').array()` を削除
- **期待結果**: 列車のホーム表示判定が `trainStopPatterns` の存在のみに一本化される
- **依存**: なし

### TASK-1.7: `platformLocationCells` の `nearPlatformCell` を `xPositionMeters` に置き換え
- **対象ファイル**: `packages/database/src/schema.ts`
- **実装内容**:
  - `nearPlatformCell: integer('near_platform_cell')` を削除
  - `xPositionMeters: decimal('x_position_meters', { precision: 6, scale: 2 })`（nullable、null=コンコース全体）を追加
- **期待結果**: 設備アクセス点の位置がメートル単位になる
- **依存**: なし

### TASK-1.8: `facilityConnections` に対面乗り換え帯の範囲カラムを追加
- **対象ファイル**: `packages/database/src/schema.ts`
- **実装内容**:
  - `xRangeStart: decimal('x_range_start', { precision: 6, scale: 2 })`（nullable）を追加
  - `xRangeEnd: decimal('x_range_end', { precision: 6, scale: 2 })`（nullable）を追加
- **期待結果**: `connectedPlatformId` を指定した対面乗り換え接続に、自ホーム座標系での帯範囲を持たせられる
- **依存**: なし

### TASK-1.9: マイグレーションファイル生成
- **コマンド**: `pnpm run db:generate`
- **期待結果**: `packages/database/drizzle/` 配下に新しいマイグレーションファイルが生成される
- **依存**: TASK-1.1〜TASK-1.8
- **注意**: `pnpm run db:push` で対話型ウィザードが表示された場合は、選択内容を開発者に提示して完了まで待機すること

---

## Phase 2: 既存データのリセット

`requirements.md` REQ-8.1/8.2 の通り、開発中データのため移行スクリプトは作成せずリセットする。
適用先は Neon の `development` ブランチ（[ADR-0004](../adr/0004-neon-branch-dev-environment.md)）。

> **リセットの復旧は2段階で、2段目は手作業である。**
> `update-odpt` が再構築するのは駅・路線・駅間接続までで、
> **ホーム以下（`platforms` / 停車位置 / コンコース / 設備）は Admin での手入力データ**である。
> TASK-2.4 は Admin UI（Phase 4）の完成を待つため、**Phase 4 の後に実行する**。

### TASK-2.1: 旧移行スクリプトを削除
- **対象ファイル**: `apps/scripts/src/migrate-platform-locations.ts`（削除）,
  `apps/scripts/src/fix-dev-migrations.ts`（削除）
- **実装内容**: ファイル自体を削除し、`package.json`（ルート・`apps/scripts` 両方）の
  `migrate-platform-locations` / `fix-dev-migrations` コマンドも削除する
- **依存**: なし
- **注意**: `fix-dev-migrations.ts` は `migrate-platform-locations` を案内する出力を含んでおり、
  削除対象のコマンドを指したまま残すと無効な参照になる。同スクリプトの実行条件
  （`__drizzle_migrations` に0000未記録・`platform_location_cells`未作成）自体は、
  TASK-2.2 実施時点の `development` ブランチで実際に該当することが判明した
  （0000のみ記録・0001以降未適用。原因は `main` 自体が過去に一度も
  `db:migrate` されていなかったため）。ただし対応はスクリプトの実行ではなく
  TASK-2.2 で採った「未使用データのTRUNCATE→`db:migrate`で0001〜0003を通しで適用」で
  十分だったため、削除の判断自体は変えていない

### TASK-2.2: 開発DB（Neon `development`）へのマイグレーション適用
- **コマンド**: `pnpm run db:migrate`（**`db:push` ではない。理由は下記「実施結果」参照**）
- **期待結果**: 新スキーマが Neon の `development` ブランチに反映される。旧テーブル・カラムに依存していたデータは失われる
- **依存**: TASK-1.9, TASK-2.1, TASK-0.5.1
- **備考**: データを壊した場合は `main` から `development` を作り直す（コピーオンライトで即時）
- **注意**: 既存の `platforms` 行には `physicalLength = 0`（未入力の暫定値）が入る。
  `maxCarCount` からの自動変換は行わない（TASK-1.1 の注意参照）
- **実施結果**（2026-08-15）:
  - `db:push` ではなく `db:migrate` を使用した。0003（本Issueで生成）は
    TASK-1.9 で既に生成済みのため、`db:push` を使うと drizzle-kit が
    rename/新規追加を判別できず対話ウィザードが発生する。特に
    `physicalLength`/`xPositionMeters` は既存カラムからのrenameではなく
    新規追加（drop+add）であり、誤ってrenameを選択すると号車数（整数）が
    メートル値として残る静かなデータ破損になるため、生成済みマイグレーションを
    そのまま適用する `db:migrate` を選んだ
  - 適用前チェックで `development` ブランチの `__drizzle_migrations` が
    **1行（0000のみ）** であることが判明した。TASK-0.5.1 で `main` から
    ブランチ作成したにもかかわらず、`main` 自体が過去に一度も `db:migrate`
    されていなかったため（`db:push` のみで運用されていた）、0001〜0002
    （元のIssue #29のスキーマ変更）も未適用の状態だった
  - 0001〜0002 の適用には `station_facilities.platform_location_cell_id`
    への `NOT NULL` 制約（0002）があり、これを満たすデータ移行を行っていた
    `migrate-platform-locations.ts` は TASK-2.1 で削除済みだったため、
    適用前に `TRUNCATE TABLE platform_locations CASCADE`（`platform_locations`
    24件・`station_facilities` 37件・`facility_connections` 32件を削除。
    `platforms` 14件・`trains` 10件は列変更のみで維持）を実施した。
    REQ-8.1/8.2 が想定するリセット対象そのものであり、0002→0003の
    号車→メートル変換もどのみち自動移行不可能（TASK-1.1参照）なため、
    0001→0002の間だけデータを保持する意味は無いと判断した
  - `main`（本番）へ同様の変更を適用する際の戦略は本Issueのスコープ外の
    意思決定であり、開発者の判断待ち（TASK-2.2実施時点で `main` の実データ量は未確認）
  - 適用後、`pnpm run db:migrate` は0001〜0003を通しで正常適用。
    `__drizzle_migrations` は4行、削除対象カラム・テーブル
    （`max_car_count`/`near_platform_cell`/`limited_to_platform_ids`/
    `platform_car_stop_positions`）は全て消え、新規カラム・テーブル・一意制約は
    全て存在することを確認した

### TASK-2.3: ODPTデータの再取得
- **コマンド**: `pnpm run update-odpt`
- **期待結果**: `stations` / `lines` / `stationLines` / `stationConnections` / `operators` /
  `odptMetadata` が再構築される
- **依存**: TASK-2.2, TASK-0.5.3
- **注意**: **`update-odpt` は `platforms` 以下を一切作らない。**
  ホーム・列車・停車位置・コンコース・設備は元々 Admin での手入力データであり、
  このタスクでは復旧しない（TASK-2.4 で扱う）
- **実施結果**（2026-08-15）: 0003は `stations`/`lines`/`stationLines`/`stationConnections`/
  `operators`/`odptMetadata` に影響しないため、これらは元々リセット対象外。
  実行結果は両オペレーター（TokyoMetro・Toei）とも `No updates detected`
  （ODPTハッシュ一致による正常スキップ）。これはPhase 0.5で移行した
  `withTransaction` 経由の書き込みパイプラインが、マイグレーション適用後も
  壊れていないことの疎通確認として機能した

### TASK-2.4: MVP対象範囲のデータを Admin で手入力
- **実装内容**: リセットで失われた手入力データのうち、#29 の検証に必要な範囲を再入力する
  - MVP対象駅（新宿駅 3・4番線相当）のホーム・`physicalLength`・停車位置パターン・
    コンコース・設備
  - 対面乗り換え検証用に赤坂見附相当を1駅
- **期待結果**: TASK-6.3〜6.5 の検証を実行できるデータが揃う
- **依存**: TASK-2.3, Phase 4（Admin UI が無いと入力できない）
- **注意**:
  - **REQ-6.1 により、停車位置パターンを登録するまで Web側ではどのホームにも列車が
    1本も表示されない。** これは不具合ではなく仕様だが、リセット直後は
    「全ホームで列車が消えた」状態になる
  - 全駅への再入力は #29 のスコープ外。MVP対象駅から順に、必要になった時点で入力する

---

## Phase 2.5: アーキテクチャ基盤

参照: [ADR-0001](../adr/0001-layer-structure.md) / [ADR-0002](../adr/0002-dependency-inversion-ports.md)

> **このPhaseは Phase 3・5 の前提である。** ここで境界を機械強制しないまま
> 進めると、移行が中途半端なまま元の構造に戻る。

### TASK-2.5.1: `packages/eslint-config` を新規作成
- **対象ファイル**: `packages/eslint-config/{package.json,base.mjs,next-app.mjs}`（新規）
- **実装内容**:
  - パッケージ名 `@furatora/eslint-config`（`@furatora/typescript-config` と同じ構成に倣う）
  - `next-app.mjs` に `design.md`「レイヤーと依存ルール」の `no-restricted-imports` を実装
  - 制限パターンは**ワイルドカードにせず列挙**する
    （`@furatora/database/enums` を意図的に除外するため）
- **期待結果**: 4層の依存ルールが共有パッケージとして定義される
- **依存**: なし
- **実施結果**（2026-08-17）: `package.json` に `exports`（`./base`/`./next-app`）を明示した。
  理由: Node ESMの `import` はサブパス指定時に `exports` マップが無いと拡張子解決を
  行わず、`@furatora/eslint-config/next-app` が解決できずビルドエラーになったため
  （`@furatora/typescript-config` はJSONの `extends` 解決経路が異なり `exports` 不要だが、
  ESLint flat configはNode ESM importなので必須）。`next-app.mjs` は依存ルールに加えて
  既存の `eslint-config-next`（`core-web-vitals`/`typescript`）も内包させた
  （各アプリが専用configを持つと、従来ルートが担っていたNext.js標準ルールが
  引き継がれず消えてしまうため）。`eslint-config-next` は
  `packages/eslint-config` 自身の `dependencies` として宣言（暗黙のルート経由解決に頼らない）

### TASK-2.5.2: 各アプリに `eslint.config.mjs` を配置
- **対象ファイル**: `apps/web/eslint.config.mjs`, `apps/admin/eslint.config.mjs`（新規）
- **実装内容**:
  - `@furatora/eslint-config/next-app` を配列展開で読み込む薄い合成のみ
  - 移行中の除外設定（既存 `src/components/**` 等）は**各アプリ側に置く**
- **期待結果**: flat config の `files` グロブが各アプリを基準に解決される
- **依存**: TASK-2.5.1
- **注意**: ルートの `eslint.config.mjs` 1つでは
  `files: ['src/app/**']` が `apps/web/src/app/**` にマッチせず、
  **ルールが1件も適用されないまま lint が成功する**
- **実施結果**（2026-08-17）: 除外リストは `src/components/**` のようなディレクトリ丸ごとの
  offにはせず、既存違反ファイルを個別に列挙した（web 11件・admin 45件）。理由:
  TASK-2.5.3の検証は「`src/app/**` 配下に新規追加したファイルにルールが効くこと」を
  要求しており、ディレクトリ単位の除外だと検証用の新規ファイルも道連れで除外されて
  しまい検証にならないため。また `[stationId]` 等のNext.js動的ルートの角括弧は
  minimatchの文字クラス構文と衝突し無視されるため、`\\[`/`\\]` でエスケープが必要
  だった（JS文字列リテラル内では `\[`（バックスラッシュ1つ）は認識されないエスケープ
  として無視されるため、ファイル中には `\\[`（2つ）が必要）。この除外リストとは無関係に、
  `apps/admin/src/components/{LineDirectionForm,PlatformForm}.tsx` に
  `react-hooks/set-state-in-effect` エラーが2件存在するが、これはルートの旧設定でも
  同様に発生する既存の別問題であり本タスクの対象外

### TASK-2.5.3: ESLint ルールが発火することを検証
- **実装内容**:
  1. `apps/web/src/app/` 配下に `import { db } from '@furatora/database/client';` を含む一時ファイルを置く
  2. `pnpm run lint` が**そのファイルでエラーになる**ことを確認
  3. 一時ファイルを削除
  4. `apps/admin` でも同様に確認
- **期待結果**: 依存ルールが実際に強制されていることの確証が得られる
- **依存**: TASK-2.5.2
- **注意**: **省略禁止。**「違反ゼロで通った」と「ルールが未適用」は lint の出力上区別がつかない
- **実施結果**（2026-08-17）: web・admin両方で確認。一時ファイル
  （`src/app/__lint_verify_tmp/page.tsx`）が `no-restricted-imports` エラーになることを
  確認後、削除した

### TASK-2.5.4: `apps/web` にテスト実行環境を構築
- **対象ファイル**: `apps/web/vitest.config.ts`, `apps/web/package.json`, `apps/web/src/test/setup.ts`（新規）
- **実装内容**: `apps/admin` の既存設定（vitest + RTL + jsdom）を踏襲し、`test` script を追加
- **期待結果**: `pnpm --filter @furatora/frontend test` が実行できる
- **依存**: なし
- **注意**: [ADR-0002](../adr/0002-dependency-inversion-ports.md) の**前提条件**。
  これが無いまま #29 をマージすると ADR-0002 は Level 1 へ差し戻しになる
- **実施結果**（2026-08-17）: `pnpm --filter @furatora/frontend test` はvitest・jsdom・
  setupファイルを正常に読み込んで実行された。テストファイルがまだ0件のため
  `No test files found` で終了コード1になるが、これは想定通り（最初のテストは
  TASK-5.8で追加する）。バージョンは `apps/admin` と完全に揃えた
  （`vitest@^4.0.18`/`jsdom@^28.1.0`/`@testing-library/*`/`@vitejs/plugin-react@^5.1.4`）

### TASK-2.5.5: ディレクトリ骨組みを作成
- **対象**: `apps/web/src/{features,shared,external}/`, `apps/admin/src/{features,shared,external}/`
- **実装内容**: `design.md`「変更対象」のツリーに沿って空ディレクトリを作成する
- **期待結果**: Phase 3・5 の移行先が確定する
- **依存**: なし
- **実施結果**（2026-08-17）: Gitは空ディレクトリを追跡しないため、各ディレクトリに
  `.gitkeep` を置いた（Phase 3・4・5で実ファイルが追加され次第、不要になったものから
  削除してよい）

---

## Phase 3: Admin API更新 + features層移行

対象feature: `platform` / `stop-pattern`（+ 既存の `train` / `facility` は最小限）

### TASK-3.1: バリデーションを `features/*/schema.ts` へ分割・更新
- **対象ファイル**: `apps/admin/src/lib/validations.ts`（分割元）→ `apps/admin/src/features/*/schema.ts`
- **実装内容**:
  - `platformSchema`: `maxCarCount: z.number().int().min(1)` を `physicalLength: z.number().positive()` に変更
  - `trainSchema`: `limitedToPlatformIds` を削除
  - `carStructureSchema`: `carLength: z.number().positive().nullable().optional()` を追加
  - `cellSchema`: `nearPlatformCell` を `xPositionMeters: z.number().nullable()` に変更
  - `connectionSchema`: `xRangeStart: z.number().nullable().optional()`, `xRangeEnd: z.number().nullable().optional()` を追加
  - `trainStopPatternSchema` を新規追加:
    ```typescript
    const trainStopPatternCarSchema = z.object({
      carNumber: z.number().int().min(1),
      startMeters: z.number(),
      endMeters: z.number(),
    }).refine((v) => v.startMeters < v.endMeters, {
      message: '開始位置は終了位置より小さい値にしてください',
    });

    const trainStopPatternSchema = z.object({
      platformId: z.string().uuid(),
      trainId: z.string().uuid(),
      cars: z.array(trainStopPatternCarSchema).min(1),
    });
    ```
  - 既存テスト `lib/validations.test.ts` も移動先に追随させる
- **依存**: TASK-2.5.5
- **実施結果**（2026-08-17）: `platformSchema` → `features/platform/schema.ts`、
  `trainSchema`（＋`carStructureItemSchema`/`trainEquipmentSchema`） → `features/train/schema.ts`、
  `cellSchema`/`connectionSchema`/`facilitySchema`/`platformLocationSchema` → `features/facility/schema.ts`、
  新規 `trainStopPatternSchema` → `features/stop-pattern/schema.ts` に配置した。ADR-0001の対象3feature
  （`platform`/`stop-pattern`）に該当しない `operatorSchema` 等7スキーマは `lib/validations.ts` に残した。
  テストも各 `features/*/schema.test.ts` に分割し、`lib/validations.test.ts` は残存スキーマのみに縮小した
  （プロジェクトの「テストファイルの配置」規約に従い同階層へ配置）。移動時に
  `platformLocationSchema.safeParse({ platformId })` を成功と誤って期待していた既存テストの不整合
  （`cells`が必須のため実際は失敗する）を発見し、期待値を修正した

### TASK-3.2: `platforms` API更新
- **対象ファイル**:
  - `apps/admin/src/features/platform/ports.ts`（新規）: `PlatformRepository`
  - `apps/admin/src/external/repository/platformRepository.ts`（新規）
  - `apps/admin/src/app/api/stations/[stationId]/platforms/route.ts`, `.../[platformId]/route.ts`
- **実装内容**:
  - リクエスト/レスポンスの `maxCarCount` を `physicalLength` に置き換える
  - `carStopPositions` の受け渡し処理（`platformCarStopPositions` 由来）を削除する
  - POST/PUT/DELETEを `PlatformRepository` 経由に薄くする（GETは直dbのまま。理由は下記「GETをQuery Service化しない理由」参照）。`platforms` は子テーブルを持たない単一テーブルのため `withTransaction` は使わない（ADR-0005「単一テーブルの単純な書き込みは`db`のままでよい」）
- **依存**: TASK-3.1, TASK-1.9
- **実施結果**（2026-08-17）: `PlatformRepository`は`create`/`update`/`delete`の3メソッドのみを持ち、
  `findById`等の読み取りメソッドは公開しない（ADR-0003が禁止する汎用CRUD Repositoryを避けるため）

### TASK-3.3: `trains` API更新
- **対象ファイル**: `apps/admin/src/features/train/schema.ts`（新規）, `apps/admin/src/app/api/trains/route.ts`, `.../[trainId]/route.ts`
- **実装内容**: `limitedToPlatformIds` の受け渡しを削除。`carStructure` の各要素に `carLength` を追加して保存する
- **注意**: `train`は「既存のtrain/facilityは最小限」の対象。Repository化は行わず、直dbのまま（既存の非原子な delete→insert パターンも変更しない。ADR-0005の適用範囲表にも`trains`は含まれていない）
- **依存**: TASK-3.1, TASK-1.9
- **実施結果**（2026-08-17）: 方針通りRepository化は行わず、`trainCarStructures`/`trainEquipments`の
  delete→insertも既存のまま維持した

### TASK-3.4: `platform-locations` API更新 + Repository化 + 原子化
- **対象ファイル**:
  - `apps/admin/src/features/facility/{schema.ts,ports.ts}`（新規）: `PlatformLocationRepository`
  - `apps/admin/src/external/repository/platformLocationRepository.ts`（新規）
  - `apps/admin/src/app/api/stations/[stationId]/platform-locations/route.ts`
  - `.../platform-locations/[locationId]/route.ts`
  - `.../platform-locations/[locationId]/duplicate/route.ts`
- **実装内容**:
  - `cells[].nearPlatformCell` → `cells[].xPositionMeters`
  - `connections[]` に `xRangeStart`/`xRangeEnd` を追加してCRUD・複製処理を更新
  - POST/PUT/DELETE/duplicateを `PlatformLocationRepository` 経由に薄くする。`create`/`update`/`duplicate` は複数テーブルにまたがるため `withTransaction` で原子化する
    （現状は非原子。途中失敗で設備が消えたまま復元されない）。`delete` は単一DELETE文＋CASCADEで完結するため`db`のまま
  - GETは直dbのまま（下記「GETをQuery Service化しない理由」参照）
- **依存**: TASK-3.1, TASK-1.9, TASK-0.5.2
- **参照**: [ADR-0005](../adr/0005-write-atomicity-driver.md)
- **実施結果**（2026-08-17）: `PlatformLocationRepository`の`duplicate`は「元データの読み取り→複製書き込み」を
  1メソッドに閉じ込めた。読み取り部分はメソッド内部の実装詳細であり、`findById`のような公開読み取りメソッドは
  追加していない。この結果、`[locationId]/route.ts`（PUT/DELETE）と`[locationId]/duplicate/route.ts`は
  `@furatora/database`を一切importしなくなり、`eslint.config.mjs`の除外リストから削除した

### GETをQuery Service化しない理由（TASK-3.2/3.3/3.4/3.5共通）

[ADR-0003](../adr/0003-read-write-separation.md)「適用範囲」節が「admin の一覧・編集ページの Query Service 化（N+1解消）は後続Issue」と明記している通り、Phase 3では上記各APIのGETをQuery Service化せず、`route.ts` 内で `db` を直接使う現状の実装を維持する。書き込み（POST/PUT/DELETE）のみ各Repositoryに切り出す。

この後続作業は [Issue #48](https://github.com/Natsugure/furatora/issues/48) として起票済み。

### TASK-3.5: `train-stop-patterns` API + `StopPatternRepository` 新規作成
- **対象ファイル**:
  - `apps/admin/src/features/stop-pattern/ports.ts`（新規）
  - `apps/admin/src/external/repository/stopPatternRepository.ts`（新規）
  - `apps/admin/src/app/api/stations/[stationId]/train-stop-patterns/route.ts`（新規）
  - `.../train-stop-patterns/[patternId]/route.ts`（新規）
  - `apps/admin/src/di.ts`（新規）
- **実装内容**:
  - `GET`: 指定ホームの全 `trainStopPatterns` を `trainStopPatternCars` とJOINして返す（直db。理由は上記「GETをQuery Service化しない理由」参照）
  - `POST`: 受け取った `cars[]`（クライアント算出済み）をそのまま保存する。
    **`withTransaction` 必須**（親の採番IDを子に渡すため `db.batch()` では表現できない）
  - `DELETE`: `trainStopPatterns` を削除（CASCADEで `trainStopPatternCars` も削除）。`[patternId]/route.ts` はこのDELETEのみのため、DB importを一切持たない完全に薄いファイルになる
- **期待結果**: ホーム・列車ごとに停車位置パターンを原子的に保存・取得・削除できる
- **依存**: TASK-3.1, TASK-1.9, **TASK-0.5.2**
- **参照**: [ADR-0005](../adr/0005-write-atomicity-driver.md)
- **実施結果**（2026-08-17）: `apps/admin/src/di.ts` は `platformRepository` / `platformLocationRepository` /
  `stopPatternRepository` の3つを手動配線するコンポジションルートとして実装した（ADR-0002「DIライブラリを使わない」）。
  admin は usecases 層を持たず、route.ts が各Repositoryを直接呼び出す構成とした（design.mdのツリー通り）

### TASK-3.6: 削除カラムを参照している既存ページを追随させる（層移行はしない）
- **対象ファイル**:

  | ファイル | 参照している削除対象 | 対応 |
  |---|---|---|
  | `apps/admin/src/app/stations/[stationId]/platforms/[platformId]/edit/page.tsx` | `platformCarStopPositions`（import・クエリ）, `maxCarCount` | 停車位置の取得を削除し、`physicalLength` を渡す |
  | `apps/admin/src/app/stations/[stationId]/facilities/page.tsx` | `maxCarCount`（一覧表示）, `nearPlatformCell`（`orderBy`・表示） | `physicalLength` / `xPositionMeters` に置き換え |
  | `apps/admin/src/app/stations/[stationId]/facilities/[locationId]/edit/page.tsx` | `nearPlatformCell` | `xPositionMeters` に置き換え |
  | `apps/admin/src/app/trains/[trainId]/edit/page.tsx` | `limitedToPlatformIds` | 受け渡しを削除 |
  | `apps/admin/src/lib/validations.test.ts` | `maxCarCount` のフィクスチャ | `physicalLength` に更新（TASK-3.1 の移動とあわせて行う） |
  | `apps/admin/src/components/PlatformForm.tsx` | `CarStopPosition`型import・`maxCarCount`・停車位置UI | `physicalLength`（小数対応）入力に置き換え、停車位置UIを削除（`@furatora/database/schema`のimportが不要になる） |
  | `apps/admin/src/components/TrainForm.tsx` | `limitedToPlatformIds`・`CarStructure`/`FreeSpace`/`PrioritySeat`型import | 走行制限ホームUIを削除し`carLength`入力を追加。DB型importをローカル型定義に置き換え（`@furatora/database/schema`のimportが不要になる） |
  | `apps/admin/src/components/FacilityForm.tsx` | `nearPlatformCell` | `xPositionMeters`入力に置き換え、`xRangeStart`/`xRangeEnd`入力を追加 |

- **実装内容**: 上記を**現在の位置のまま**修正する。`features/` へは移さない
- **期待結果**: `apps/admin` の型チェック（`tsc --noEmit`）が通る
- **依存**: TASK-1.9, TASK-3.1
- **注意**: **これらは `design.md` の「後続Issue」対象ではない。**
  後続Issueに送るのは*層移行*であって、削除したカラムへの追随は #29 の必須範囲である。
  漏らすと TASK-6.1（ビルド確認）で必ず落ちる
- **実施結果**（2026-08-17）: フォーム3本（`PlatformForm`/`TrainForm`/`FacilityForm`）は型チェックを通すため
  Phase 3 の時点で新カラムに対応する最小限の入力コンポーネントへ更新した。ただし
  **`features/*/components/` への物理的な移動と、design.mdが要求する完成されたUX
  （ホーム長併記・範囲外許容の説明文・自動算出プレビュー等）はPhase 4のタスクとして残す。**
  `apps/web`側は本タスクの対象外（Phase 5）であり、依然として旧カラムを参照し型エラーが残る。
  `pnpm --filter @furatora/admin exec tsc --noEmit` は通るが、ルートの `pnpm run build` は
  `apps/web` が原因で依然失敗する（TASK-6.1 で解消）

---

## Phase 4: Admin UI更新

> フォーム3本を `features/*/components/` へ移動するため、**これらを import している6ページ**の
> import パス更新が発生する（`platforms/new`, `platforms/[platformId]/edit`,
> `facilities/new`, `facilities/[locationId]/edit`, `trains/new`, `trains/[trainId]/edit`）。
> 各タスクの移動とあわせて行うこと。

### TASK-4.1: `PlatformForm.tsx` 更新・移動
- **対象ファイル**: `apps/admin/src/components/PlatformForm.tsx` → `src/features/platform/components/PlatformForm.tsx`
- **実装内容**: `maxCarCount` の数値入力（号車数）を `physicalLength` の数値入力（メートル、小数対応）に置き換える。`carStopPositions` 関連の入力UI（基準号車・基準枠番号・方向）を削除する
- **依存**: TASK-3.2
- **実施結果**（2026-08-20）: 入力内容自体（`physicalLength`）は TASK-3.6 の時点で既に対応済みだったため、
  本タスクの実質は `features/platform/components/` への移動と、`eslint.config.mjs` の
  `legacyExclusions` から `src/components/PlatformForm.tsx` を除去することだった。除去後も
  `pnpm --filter @furatora/admin lint` はエラー0件（`no-restricted-imports` が実際に適用された
  上で違反が無いことを確認）。あわせて、`physicalLength` の `NumberInput` が `min={0}` かつ
  初期値 `0` である一方 `features/platform/schema.ts` は `positive()` を要求するため、`0` のまま
  送信すると400になり `alert('保存に失敗しました')` としか出ない不具合を発見。送信前に
  `physicalLength <= 0` を弾き、`0` が未入力を意味する暫定値であることを `description` に明記した
  （`docs/domain/platform-coordinate-system.md`参照）

### TASK-4.2: `TrainForm.tsx` 更新・移動
- **対象ファイル**: `apps/admin/src/components/TrainForm.tsx` → `src/features/train/components/TrainForm.tsx`
- **実装内容**: `limitedToPlatformIds` のホーム選択UIを削除する。号車構成（`carStructure`）の各行に、実長（メートル、任意入力）の数値フィールドを追加する
- **依存**: TASK-3.3
- **実施結果**（2026-08-20）: TASK-4.1 と同様、内容面は TASK-3.6 で対応済み。移動と
  `legacyExclusions` からの除去のみ実施。既存の「未指定の場合は標準値（20.0m）を使用します」
  という説明文が `carSegments.ts` の `DEFAULT_CAR_LENGTH` と同じ値であることを明記する形に更新した

### TASK-4.3: `FacilityForm.tsx` 更新・移動
- **対象ファイル**: `apps/admin/src/components/FacilityForm.tsx` → `src/features/facility/components/FacilityForm.tsx`
- **実装内容**:
  - アクセス点の「枠番号」数値入力を「**ホーム端（`x=0`）からのメートル位置**」入力に置き換える。
    `description` には基準がホーム端であることとホーム長を示し、範囲外も入力可であることを明記する
    （**「原点」という語を単独で使わない**。`design.md`「`FacilityForm.tsx`」参照）
  - 接続（`connections`）に `connectedPlatformId` を指定した場合のみ表示される、対面乗り換え帯の範囲入力（開始・終了メートル）を追加する
- **依存**: TASK-3.4
- **実施結果**（2026-08-20）: `xPositionMeters`・対面乗り換え帯入力は TASK-3.6 で対応済み。
  本タスクでは移動に加え、`description` にホーム長を併記する残作業を行った。
  `GET /api/stations/[stationId]/platforms` が `id`/`platformNumber` のみ返していたため
  `physicalLength` を追加し、選択中ホームの長さを「ホーム端（x=0）からの距離。ホーム長: n.nn m。
  範囲外（負の値やホーム長を超える値）も入力できます。」の形で表示するようにした
  （対面乗り換え帯の開始・終了入力も同様）。このファイルはもともと `legacyExclusions` に
  含まれていなかった（DB importを持たないため元から `no-restricted-imports` を通過していた）

### TASK-4.4: `TrainStopPatternForm.tsx` 新規作成
- **対象ファイル**:
  - `apps/admin/src/features/stop-pattern/domain/carSegments.ts`（新規）
  - `apps/admin/src/features/stop-pattern/components/TrainStopPatternForm.tsx`（新規）
- **実装内容**:
  - `domain/carSegments.ts` に純関数として算出ロジックを実装（DB非依存。テスト対象）:
    ```typescript
    const DEFAULT_CAR_LENGTH = 20.0;

    /** x=0 に近い側の端にあるのが1号車か、最終号車か */
    export type CarNumberOrder = 'carOneNearest' | 'lastCarNearest';

    export function buildCarSegments(
      carStructure: { carNumber: number; carLength: number | null }[],
      startMeters: number,   // ホーム端(x=0)から、編成の x=0 側の端までの距離
      order: CarNumberOrder,
    ): { carNumber: number; startMeters: number; endMeters: number }[] {
      const byCarNumber = [...carStructure].sort((a, b) => a.carNumber - b.carNumber);
      // x=0 に近い側から順に積算する
      const fromOrigin =
        order === 'carOneNearest' ? byCarNumber : [...byCarNumber].reverse();

      let cursor = startMeters;
      const segments = fromOrigin.map((car) => {
        const start = cursor;
        cursor = start + (car.carLength ?? DEFAULT_CAR_LENGTH);
        return { carNumber: car.carNumber, startMeters: start, endMeters: cursor };
      });

      return segments.sort((a, b) => a.carNumber - b.carNumber);
    }
    ```
  - フォーム側: ホーム・列車のドロップダウン選択（ホーム長 `physicalLength` を併記）
  - 「編成の端の位置（`x=0` に近い側）」の数値入力と、号車番号の向きの二択
    （`design.md`「Admin UI変更」のモック参照）
  - `buildCarSegments()` の結果をプレビュー表示
  - プレビューされた各号車の `startMeters`/`endMeters` を個別に上書きできる入力欄
  - 保存時に確定座標を `POST /api/stations/:stationId/train-stop-patterns` へ送信
- **依存**: TASK-3.5
- **注意**:
  - **どの号車も `startMeters < endMeters` を保つこと**（`order` によらず。DB側の
    バリデーションもこれを要求する）。`lastCarNearest` でも各号車の区間の向きは反転しない
  - 「1号車先端を x=0 に揃える」というUIは**作らない**。原点はホーム端であり、
    列車の位置から導出しない（`design.md`「座標系のルール」参照）
- **実施結果**（2026-08-20）: `carSegments.ts` は上記の実装をそのまま採用し、
  `carSegments.test.ts` を追加（7ケース: `carLength`全指定/全未指定/混在、
  `carOneNearest`/`lastCarNearest`、`order`によらず`startMeters < endMeters`が保たれること、
  戻り値が`carNumber`昇順であること、負の`startMeters`）。全テストパス。
  `TrainStopPatternForm.tsx` は design.md のモックに1点だけ変更を加えた:
  **ホームの選択をドロップダウンにせず固定表示にした**（URL の `platformId` でホームが
  一意に決まるため。開発者承認済み。design.md「Admin UI変更」を実施結果に合わせて更新した）。
  それ以外（列車ドロップダウン、編成の端の位置、号車番号の向きの二択、自動計算プレビュー、
  号車ごとの上書き入力）はモック通り実装した。409（重複登録）を受けた場合の専用メッセージ表示、
  `startMeters >= endMeters` のクライアント側バリデーションも実装した

### TASK-4.5: 停車位置パターン一覧・編集ページ作成
- **対象ファイル**: `apps/admin/src/app/stations/[stationId]/platforms/[platformId]/stop-patterns/page.tsx`（新規）
- **実装内容**: 対象ホームに登録済みの `trainStopPatterns` を一覧表示し、`TrainStopPatternForm` への導線（新規作成・編集・削除）を提供する
- **依存**: TASK-4.4
- **実施結果**（2026-08-20）: 当初の想定より対応範囲が広がった。理由は以下の2点。
  1. **「編集」の実現に `StopPatternRepository.update()` が必要だった。** Phase 3 時点の
     `StopPatternRepository` は `save`（insert専用）と `delete` のみで、design.md の
     port定義もこれに倣っていた。`update(id, pattern)` を追加し、`withTransaction` 内で
     `trainStopPatternCars` を delete→insert、`trainStopPatterns` を update する実装とした。
     `PUT /api/stations/:stationId/train-stop-patterns/:patternId` を新設（開発者承認済み。
     design.md の ports 定義を実施結果に合わせて更新した）
  2. **一覧・編集ページからのデータ取得に Query Service が必要だった。** `stop-patterns/`
     配下は `src/app/**` にマッチし、ESLint の依存ルール（`no-restricted-imports`）により
     `@furatora/database` を直接 import できない。既存ページのように「移行中の除外」に
     加える選択肢もあったが、除外リストは段階的に削る対象であり新規ファイルで増やすのは
     ADR-0001 の意図に反すると判断し、`features/stop-pattern/ports.ts` に
     `StopPatternPageQuery`（`getListByPlatform`/`getEditContext`）を追加、
     `external/query/stopPatternPageQuery.ts` で実装、`di.ts` に配線した。
     ADR-0003 は「admin の一覧・編集ページの Query Service 化は後続Issue（#48）」としているが、
     本件は既存ページの改修ではなく新規ページの必須要件であるため、この2画面分のみ
     先行導入した（開発者承認済み。design.md「変更対象」ツリーを更新した）
  - **一意制約違反の409化**: `save`/`update` とも PostgreSQL の unique_violation
    （エラーコード `23505`）を捕捉し `DuplicateStopPatternError` を throw、
    route.ts側で409に変換するようにした（design.mdエラーハンドリング表・TASK-6.4対応）
  - ページ構成は一覧 (`stop-patterns/page.tsx`) / 新規 (`stop-patterns/new/page.tsx`) /
    編集 (`stop-patterns/[patternId]/edit/page.tsx`) の3ルートとし、いずれもServer Component。
    導線は `facilities/page.tsx` のホーム一覧テーブルに「停車位置」リンクを追加する形で設置した
    （`platforms/` 配下に既存の一覧ページが存在しないため）
  - 検証: `pnpm --filter @furatora/admin exec tsc --noEmit` エラー0、
    `pnpm --filter @furatora/admin test` 76件全パス、
    `pnpm --filter @furatora/admin lint` エラー0（警告10件は既存の`no-floating-promises`
    warn運用によるもので新規増加なし。移動した3フォームの`legacyExclusions`除去後も
    エラーが出ないことを確認済み）

---

## Phase 5: Web features層構築 + UI更新

参照: [ADR-0001](../adr/0001-layer-structure.md) / [ADR-0002](../adr/0002-dependency-inversion-ports.md) / [ADR-0003](../adr/0003-read-write-separation.md)

> TASK-5.1〜5.3（層の構築）を先に済ませてから、TASK-5.5〜5.7（UI書き換え）に入る。
> 順序を逆にすると、書き換えたUIを再度書き換えることになる。

### TASK-5.1: `features/platform/domain/types.ts` にDTOを定義
- **対象ファイル**: `apps/web/src/features/platform/domain/types.ts`（新規）
- **実装内容**: `design.md`「Web表示用DTO定義」の `PlatformDTO` / `TrainStopPatternDTO` /
  `ConcourseDTO` / `FacilityConnectionDTO` を定義する
- **期待結果**: Drizzle 非依存の表示用型が確定する
- **依存**: TASK-2.5.5
- **注意**: UI固有の値（色コード・Tailwindクラス名・JSX）を含めないこと（ADR-0003のDTO制約）

### TASK-5.2: `features/platform/domain/geometry.ts` を実装 + テスト
- **対象ファイル**: `apps/web/src/features/platform/domain/geometry.ts`, `geometry.test.ts`（新規）
- **実装内容**:
  - `computeBounds(physicalLength, patterns, concourses): { minX, maxX }` を純関数として実装
  - **`[0, physicalLength]` は常に描画範囲に含める**（ホームの実体そのものであるため）
  - テストケース: 車両範囲外の設備 / 負座標 / `physicalLength` 超過 / 設備0件 /
    停車位置パターン0件（ホームだけが描画される）
- **期待結果**: viewBox算出がDB非依存になり、単体テストできる
- **依存**: TASK-5.1, TASK-2.5.4

### TASK-5.3: `features/station` の ports と usecase を作成
- **対象ファイル**:
  - `apps/web/src/features/station/domain/types.ts`（新規）
  - `apps/web/src/features/station/ports.ts`（新規）
  - `apps/web/src/features/station/usecases/getStationDetail.ts`（新規）
- **実装内容**:
  - `StationDetailQuery` interface を定義（Drizzle・Next.js を import しない）
  - `makeGetStationDetail(deps)` ファクトリを実装
- **依存**: TASK-5.1
- **注意**: **実在する画面に対してのみ port を定義する。** 乗換案内など未実装機能の
  port を先回りして作らないこと（ADR-0002）

### TASK-5.4: `external/query/stationDetailQuery.ts` を実装
- **対象ファイル**: `apps/web/src/external/query/stationDetailQuery.ts`（新規）
- **実装内容**:
  - 現行 `app/stations/[slug]/page.tsx` の `fetchStationDetails()`（約250行）を移設
  - `platforms.maxCarCount` の取得・比較処理を削除し、`physicalLength` を取得
  - `train.carCount > platform.maxCarCount` および `train.limitedToPlatformIds` による判定を削除し、
    `trainStopPatterns`（+`trainStopPatternCars`）を `platformId` でJOIN取得して、
    パターンが存在する列車のみを含めるロジックに置き換える
  - `platformLocationCells.xPositionMeters`、`facilityConnections.xRangeStart/xRangeEnd` を取得
  - **`decimal` → `number` 変換をここで行う**（DTOより上に `string` を渡さない）
- **期待結果**: Drizzle を知る唯一の場所になり、DTOを返す
- **依存**: TASK-5.3, TASK-1.9, TASK-2.2
- **注意**:
  - **クエリ本数を現状（10本）から増やさない。** 集約単位に分解してN+1を作らないこと
  - **`physicalLength === 0` のホームを除外する。** `0` は「未入力」を意味する暫定値であり
    （TASK-1.1 参照）、そのまま `computeBounds()` に渡すと描画範囲が破綻する

### TASK-5.5: `di.ts` 作成と `page.tsx` の薄化
- **対象ファイル**: `apps/web/src/di.ts`（新規）, `apps/web/src/app/stations/[slug]/page.tsx`
- **実装内容**:
  - `di.ts` で `makeGetStationDetail({ query: dbStationDetailQuery })` を配線
  - `page.tsx` から DB組み立てロジックを削除し、`di.ts` の呼び出しとJSX合成のみにする（485行 → 約70行）
- **依存**: TASK-5.4

### TASK-5.6: `TrainVisualization.tsx` をSVG viewBox方式に全面書き換え・移動
- **対象ファイル**: `apps/web/src/components/TrainVisualization.tsx` → `src/features/platform/components/TrainVisualization.tsx`
- **実装内容**: `design.md`「座標系のルール」に従い、`PlatformDTO` を受け取り `<svg viewBox="...">` で描画する。viewBox範囲は `geometry.ts` の `computeBounds()` で算出する
  - **x昇順で左→右**に描画する。ホーム端に方面ラベルは出さない（現行も出していない）
  - **`direction`（ascending / descending）の概念を持ち込まない。** 旧実装の
    `carPositions` 算出（`TrainVisualization.tsx:647-654`）は不要になる。座標はDTOが持つ
  - ドア番号の反転（旧 `reversed`、`TrainVisualization.tsx:77`, `:152`）は、
    `cars` を `carNumber` 昇順に並べたとき `startMeters` が減少していれば反転、として導出する
- **依存**: TASK-5.2, TASK-5.5

### TASK-5.7: `PlatformDisplay.tsx` / `PlatformTabs.tsx` の型更新・移動
- **対象ファイル**: `apps/web/src/components/{PlatformDisplay,PlatformTabs}.tsx` → `src/features/platform/components/`
- **実装内容**: `@furatora/database/schema` からの型 import を削除し、DTOを受け取る形に更新する
- **依存**: TASK-5.6

### TASK-5.8: usecase テストを追加（Fake注入）
- **対象ファイル**: `apps/web/src/features/station/usecases/getStationDetail.test.ts`（新規）
- **実装内容**:
  ```typescript
  const fake: StationDetailQuery = { getBySlug: async () => fixture };
  const getStationDetail = makeGetStationDetail({ query: fake });
  ```
  Drizzle のチェーンモックを書かないこと（それが Level 2 を却下した理由）
- **依存**: TASK-5.3, TASK-2.5.4
- **注意**: [ADR-0002](../adr/0002-dependency-inversion-ports.md) の**前提条件**。
  これが無い場合 ADR-0002 は Level 1 へ差し戻し

---

## Phase 6: 検証・振り返り

### TASK-6.1: ビルド確認
- **コマンド**: `pnpm run build`
- **期待結果**: ビルドエラーなし
- **依存**: Phase 1〜5 全体

### TASK-6.2: 自動テスト実行
- **コマンド**: `pnpm run test`（admin・web 両方）, `pnpm run lint`
- **期待結果**:
  - `geometry.test.ts` / `carSegments` / `getStationDetail.test.ts` が通る
  - lint がエラーなしで通る（かつ TASK-2.5.3 でルール発火を確認済み）
- **依存**: TASK-5.8, TASK-2.5.3

### TASK-6.3: MVP検証（1駅1ホーム）
- **対象**: 新宿駅 3・4番線相当（複数の停車位置パターンが存在するホーム）
- **確認項目**（`requirements.md` MVP成功基準 / `design.md` 参照）:
  1. 号車数が同じで停車位置・向きが異なる2列車パターンを矛盾なく登録できる
  2. 1両の前方・後方に別々の設備を区別して登録・表示できる
  3. 車両の停車範囲外（ホーム端 `x=0` 基準で `physicalLength` を超える、または負の位置）に設備を登録・表示できる
  5. **停車位置パターンを追加・削除しても、既存の設備・他パターンの描画位置が変化しない**
     （原点がホーム端に固定されていることの確認）
  4. ブラウザ幅を変えてもSVG要素間の位置比率が崩れない
- **依存**: TASK-6.1, **TASK-2.4**（検証対象データの入力）

### TASK-6.4: Admin手動テスト
- **確認項目**:
  - `physicalLength` を指定してホームを新規登録できる
  - 列車の号車構成に `carLength` を指定・未指定の両方で保存できる
  - 停車位置パターンの自動算出プレビューが表示され、個別の号車位置を上書きして保存できる
  - 同一ホーム・同一列車で2件目の停車位置パターンを登録しようとすると一意制約エラーになる
  - 設備のメートル位置入力、対面乗り換え帯の範囲入力が保存・編集できる
  - **原子性**: 子の insert が失敗した場合に親（`trainStopPatterns`）が残らない
  - 既存ホームの `physicalLength` が `0`（未入力の暫定値）の状態から、正の値を入力して保存できる
- **依存**: Phase 3, Phase 4

### TASK-6.5: Web手動テスト
- **確認項目**:
  - 停車位置パターンが未登録の列車がホーム表示に出てこない
  - コンコース単位グルーピング表示（#29機能）が引き続き正しく動作する
  - 対面乗り換え帯がSVG上に正しい範囲で描画される
  - `physicalLength === 0`（未入力）のホームが描画対象から除外され、例外にならない
- **依存**: Phase 5, **TASK-2.4**

### TASK-6.6: docs/spec・domain・ADR最終更新
- **対象ファイル**: `docs/spec/*.md`, `docs/domain/*.md`, `docs/adr/*.md`
- **内容**:
  - 実装を通じて明らかになった変更点（自動算出ロジックの調整、標準車両長の妥当性など）をspecに反映
  - **`docs/domain/` を実装後の姿に更新する**（追記ではなく上書き）:
    - `platform-coordinate-system.md` / `train-stop-patterns.md` 冒頭の
      **「適用状況: 未実装」注記を外す**
    - 実装で設計から変わった点（既定値・制約の追加等）を反映する
    - 変更が不要だった場合も、確認した旨を残す
  - **ADR-0001〜0005 のステータスを `Proposed` → `Accepted` に更新**
  - ADR-0002 の前提条件（TASK-2.5.4 / TASK-5.8）が満たされているか確認。
    未達なら Level 1 へ差し戻す判断を記録する
  - `docs/spec/` は次のIssueで全面的に書き換えられる。恒久的に必要な内容が
    `docs/domain/` か `docs/adr/` へ移っていることを確認する
- **依存**: TASK-6.1〜TASK-6.5
- **参照**: [`.claude/instructions/spec-driven-workflow-v2.instructions.md`](../../.claude/instructions/spec-driven-workflow-v2.instructions.md) フェーズ5

---

## タスクサマリー

| フェーズ | タスク数 | 優先度 | 推定規模 |
|---------|---------|-------|---------|
| Phase 0: docs/spec・ADR作成 | 4 | P0 | M |
| Phase 0.5: 開発環境・DBドライバ移行 | 6 | **P0** | M |
| Phase 1: スキーマ変更 | 9 | P0 | M |
| Phase 2: 既存データのリセット | 4 | P0 | M |
| Phase 2.5: アーキテクチャ基盤 | 5 | **P0** | M |
| Phase 3: Admin API + features層 | 6 | P0 | L |
| Phase 4: Admin UI更新 | 5 | P0 | L |
| Phase 5: Web features層 + UI | 8 | P1 | L |
| Phase 6: 検証・振り返り | 6 | P0 | M |
| **合計** | **53** | | |

---

## 実装順序の依存関係

```
Phase 0.5（最優先・同一PR）
  TASK-0.5.1 (Neonブランチ)
  TASK-0.5.2 (tx.ts) → 0.5.3 (update-odpt) → 0.5.4 (USE_LOCAL_DB廃止) → 0.5.6 (疎通確認)
  TASK-0.5.5 (Docker削除)
        │
        ▼
TASK-1.1〜1.8 (スキーマ) → TASK-1.9 (マイグレーション生成)
        │
        ├──────────────┬────────────────────────┐
        │              │                        │
  TASK-2.1〜2.3   Phase 2.5（Phase 3・5の前提）   │
  (データリセット)  2.5.1 → 2.5.2 → 2.5.3        │
                   2.5.4 (webテスト環境)         │
                   2.5.5 (骨組み)                │
                        │                        │
                        ▼                        ▼
                  TASK-3.1 (schema分割)     TASK-5.1 (DTO)
                        │                        │
      ┌────────┬────────┼──────────┬────────┐   ├── 5.2 (geometry+test)
      │        │        │          │        │   │
   3.2      3.3       3.4        3.5      3.6   └── 5.3 (ports/usecase)
 (platform)(train)(locations)(stop-pattern)(既存追随)   │
      │        │        │          │                   ▼
      ▼        ▼        ▼          ▼              5.4 (external/query)
    4.1      4.2      4.3        4.4                   │
                                  │                    ▼
                                  ▼              5.5 (di.ts + page薄化)
                                4.5                    │
                                  │                    ▼
                                  ▼            5.6 (TrainVisualization)
                            TASK-2.4                   │
                        (MVPデータ手入力)               ▼
                                              5.7 (Display/Tabs) → 5.8 (usecaseテスト)

Phase 3・4・5 と TASK-2.4 すべて完了 → TASK-6.1〜6.6
```

**クリティカルな依存**:
- `TASK-3.5`（停車位置パターン保存）は **`TASK-0.5.2`（tx.ts）が無いと実装できない**
- `TASK-3.4`（platform-locations原子化）も同様
- `TASK-0.5.4` は **必ず `TASK-0.5.3` の後**（逆順で本番のODPT更新が停止）
- `TASK-0.5.4` 内でも **`apps/scripts` の `--env-file-if-exists` 付与を
  `client.ts` からの dotenv 削除より先に**行う
- `TASK-3.6`（既存ページの追随）が漏れると **`TASK-6.1` が必ず落ちる**
- `TASK-2.4`（データ手入力）は Phase 4 完了後。**これが無いと TASK-6.3〜6.5 は
  検証対象のデータが存在しない**

---

## 進捗追跡

| タスクID | 状態 | 完了日 |
|---------|------|-------|
| TASK-0.1 | ✅ 完了 | 2026-08-14 |
| TASK-0.2 | ✅ 完了 | 2026-08-15 |
| TASK-0.3 | ✅ 完了 | 2026-08-15 |
| TASK-0.4 | ✅ 完了 | 2026-08-15 |
| TASK-0.5.1〜0.5.6 | ✅ 完了 | 2026-08-15 |
| TASK-1.1〜1.9 | ✅ 完了 | 2026-08-15 |
| TASK-2.1〜2.3 | ✅ 完了 | 2026-08-15 |
| TASK-2.4（Phase 4 の後に実行） | ⬜ 未着手 | - |
| TASK-2.5.1〜2.5.5 | ✅ 完了 | 2026-08-17 |
| TASK-3.1〜3.6 | ✅ 完了 | 2026-08-17 |
| TASK-4.1〜4.5 | ✅ 完了 | 2026-08-20 |
| TASK-5.1〜5.8 | ⬜ 未着手 | - |
| TASK-6.1〜6.6 | ⬜ 未着手 | - |

---

## 後続Issueに切り出すもの

本Issueのスコープ外。着手前にIssue化すること。

| 内容 | 根拠 |
|---|---|
| Server Actions移行（14フォーム / 23 API Route） | `apps/CLAUDE.md` の方針と現状が乖離 |
| `unresolved-connections/page.tsx`（556行）の分割 | admin最大の複雑度 |
| フォームライブラリ導入（`@mantine/form`） | 手書きフォーム3本で1,239行 |
| `search` / `line` / `transfer` feature の層移行 | [ADR-0001](../adr/0001-layer-structure.md) 適用範囲外 |
| admin 一覧・編集ページの Query Service 化（N+1解消） | [ADR-0003](../adr/0003-read-write-separation.md) 適用範囲外 |
| `@furatora/database/enums` の独立パッケージ化 | [ADR-0001](../adr/0001-layer-structure.md) |
| `packages/core` 抽出 | [ADR-0001](../adr/0001-layer-structure.md)（`apps/api` 発生時） |
| `platforms.physicalLength` の `default('0')` を外す | 全ホームの手入力完了が前提（TASK-1.1） |
| 停車位置パターンの方面別対応（`trainStopPatterns` に `directionId` を追加し一意キーに含める） | **上下共用の中線を持つ事業者（JR東日本等）の追加時に必須。当該Issueの見積もりに含めること。** 番線ごとに `platforms` を分ける回避策は設備の二重登録になるため不可。移行手順は [`docs/domain/train-stop-patterns.md`](../domain/train-stop-patterns.md) |
| MVP対象外の駅・ホームのデータ再入力 | Phase 2 のリセット分。必要になった駅から順次（TASK-2.4） |
| UIライブラリ再検討（Mantine / shadcn） | 優先度低 |
