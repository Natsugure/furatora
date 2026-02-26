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
import type { StrollerDifficulty } from '@furatora/database/enums'  // Enum型
```

## 接続方式
- 本番環境（Neon）: `@neondatabase/serverless` の HTTPクライアントを使用
- ローカル開発: `USE_LOCAL_DB=true` を設定することで `postgres-js` を使用

## Drizzle ORM 規約
- スキーマ定義はすべて `src/schema.ts` に集約する
- マイグレーションは `drizzle-kit generate` → `drizzle-kit migrate` の手順で行う
- `db:push` は開発環境のみ使用可（本番環境では必ず migrate を使う）

## 型定義
- Drizzle の型推論 (`InferSelectModel`, `InferInsertModel`) を積極的に使用する
- `any` 型は禁止（ルートCLAUDE.mdに準じる）

## 注意
- このパッケージはクライアント・サーバー両環境から import される
- Node.js 専用APIや `'use client'` / `'use server'` ディレクティブは使用しない