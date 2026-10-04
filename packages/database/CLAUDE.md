---
description: "DrizzleORMスキーマ・DBクライアントのコーディング規約"
applyTo: "packages/database/**"
---

# packages/database

## 概要
Node.js (TypeScript) で動作するDB クライアント・スキーマ定義パッケージ。
Next.js のApp RouterやReact固有のAPIは使用しない。

## エクスポート構成
```typescript
import { db } from '@furatora/database/client'  // DBクライアント
import { stations, lines } from '@furatora/database/schema'  // テーブル定義
import type { DirectionType } from '@furatora/database/enums'  // Enum型
```

## 接続方式
- 本番環境（Neon）: `@neondatabase/serverless` の HTTPクライアントを使用
- ローカル開発: `USE_LOCAL_DB=true` を設定することで `postgres-js` を使用

## Drizzle ORM 規約
- スキーマ定義は `src/schema/` にドメイン別のファイル（`stationMaster` / `transfer` / `platform` / `train`）で置き、`src/schema/index.ts` で再 export する。新しいテーブルは対応するドメインのファイルに足す
- マイグレーションは `drizzle-kit generate` → `drizzle-kit migrate` の手順で行う
- `db:push` は開発環境のみ使用可（本番環境では必ず migrate を使う）
  - 既知の誤検出: push は次の外部キー4本の DROP / ADD を毎回提案する。名前が63文字を超えて PostgreSQL に切り詰めて保存されており、
    drizzle-kit が切り詰め前の名前と比べるため（#154）。これ以外の差分が無ければ、DB とスキーマは一致している。
    承認せず中止し、開発者に伝える
    - `station_facilities_platform_location_cell_id_platform_location_cells_id_fk`
    - `train_stop_pattern_cars_train_stop_pattern_id_train_stop_patterns_id_fk`
    - `platform_location_cells_platform_location_id_platform_locations_id_fk`
    - `facility_connections_platform_location_id_platform_locations_id_fk`

## `enums` の制約
- `@furatora/database/enums` はアプリとドメインの packages（`platform-diagram` / `transfer-difficulty`）が共有する語彙の入口（ADR-0015 決定3）。
  ドメインの packages は `@furatora/database` のうち `enums` だけを import できる
- 入口は1つに保つ。語彙が増えたら `src/enums/` にまとまりごとのファイルで置き、`index.ts` で再 export する。個別のファイルを exports に足さない
- 配下はすべて Drizzle にも実行時の外部パッケージにも依存させない。型と `as const` の定数だけを置く
  - `src/enums/**` が import できるのは、同じディレクトリのファイル（`./` で始まり `..` を含まないパス）だけである。
    `eslint.config.mjs` の `no-restricted-imports` で、それ以外（外部パッケージ・`../schema` 等）をすべて禁止している
- 構成: `stationMaster.ts`（`DirectionType` / `PlatformSide` / `StationConnectionSource`）、
  `facility.ts`（`FACILITY_TYPE_CODES` / `FacilityTypeCode`）、`index.ts`（再 export）
- 設備コードの一覧の正は `FACILITY_TYPE_CODES` で、`facility_types` は CHECK 制約 `facility_types_code_known` で従う（ADR-0016）。
  種類を足す手順は `facility.ts` のコメントを見る

## 型定義
- Drizzle の型推論 (`InferSelectModel`, `InferInsertModel`) を積極的に使用する
- `any` 型は禁止（ルートCLAUDE.mdに準じる）

## 注意
- このパッケージはクライアント・サーバー両環境から import される
- Node.js 専用APIや `'use client'` / `'use server'` ディレクティブは使用しない