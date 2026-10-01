---
description: "DrizzleORMスキーマ・DBクライアントのコーディング規約"
applyTo: "packages/database/**"
---

# packages/database

## 概要
Node.js (TypeScript) で動作するDB クライアント・スキーマ定義パッケージ。
Next.js のApp RouterやReact固有のAPIは使用しない。

## Drizzle ORM 規約
- スキーマ定義は `src/schema/` にドメイン別のファイル（`stationMaster` / `transfer` / `platform` / `train`）で置き、`src/schema/index.ts` で再 export する。新しいテーブルは対応するドメインのファイルに足す
- マイグレーションは `drizzle-kit generate` → `drizzle-kit migrate` の手順で行う
- `db:push` は開発環境のみ使用可（本番環境では必ず migrate を使う）

## `enums` の制約
- `src/enums.ts` はアプリとドメインの packages（`platform-diagram` / `transfer-difficulty`）が共有する語彙の置き場（ADR-0015）。
  ドメインの packages は `@furatora/database` のうち `enums` だけを import できる
- Drizzle にも実行時の外部パッケージにも依存させない。型と `as const` の定数だけを置く

## 型定義
- Drizzle の型推論 (`InferSelectModel`, `InferInsertModel`) を積極的に使用する
- `any` 型は禁止（ルートCLAUDE.mdに準じる）

## 注意
- このパッケージはクライアント・サーバー両環境から import される
- Node.js 専用APIや `'use client'` / `'use server'` ディレクティブは使用しない