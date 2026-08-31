# ふらとら (furatora)

**日本語** | [English](#english)

---

## 日本語

### 概要

**ふらとら** は、日本の鉄道においてベビーカー・車いすを利用しやすい設備の位置と乗り換え案内を提供するWebアプリです。

鉄道駅でのバリアフリー設備（エレベーター・多機能トイレなど）の位置や、乗り換えのしやすさの評価、さらに列車内のフリースペース・優先席の号車位置をビジュアルで確認できます。

### 主な機能

- **駅検索** - 路線・事業者から駅を絞り込み
- **プラットフォーム情報** - ホームに停車する列車の号車位置とバリアフリー設備の位置を視覚的に表示
- **乗り換え難易度** - ベビーカー・車いすでの乗り換えしやすさをレベル別に表示
- **設備情報** - エレベーター等の設置場所をホームの号車位置と紐付けて提供
- **ODPT連携** - 公共交通オープンデータセンター（ODPT）のAPIを活用した駅・路線データの自動取得

### 技術スタック

#### モノレポ構成

| ディレクトリ | 内容 |
|---|---|
| `apps/web` | フロントエンド（一般ユーザー向け） |
| `apps/admin` | 管理者向けデータ管理パネル |
| `apps/scripts` | データ取得・初期化スクリプト |
| `packages/database` | DB クライアント・スキーマ定義 |
| `packages/typescript-config` | 共有 TypeScript 設定 |

#### フロントエンド

| 技術 | バージョン | 用途 |
|---|---|---|
| [Next.js](https://nextjs.org/) | 16 (App Router) | Webフレームワーク |
| [React](https://react.dev/) | 19 | UIライブラリ |
| [Mantine](https://mantine.dev/) | v8 | UIコンポーネントライブラリ |
| [TailwindCSS](https://tailwindcss.com/) | v4 | ユーティリティCSSフレームワーク |
| [Lucide React](https://lucide.dev/) | - | アイコン |

#### バックエンド / データベース

| 技術 | バージョン | 用途 |
|---|---|---|
| [DrizzleORM](https://orm.drizzle.team/) | v0.45 | 型安全なORM |
| [PostgreSQL](https://www.postgresql.org/) | - | リレーショナルデータベース |
| [Neon](https://neon.tech/) | - | サーバーレスPostgreSQL（開発・本番共通） |

#### 認証・バリデーション（管理画面）

| 技術 | バージョン | 用途 |
|---|---|---|
| [Auth.js (NextAuth)](https://authjs.dev/) | v5 | GitHub OAuth認証 |
| [Zod](https://zod.dev/) | v4 | スキーマバリデーション |

#### 開発ツール

| 技術 | バージョン | 用途 |
|---|---|---|
| [TurboRepo](https://turbo.build/) | v2 | モノレポビルドシステム |
| [pnpm](https://pnpm.io/) | v10 | パッケージマネージャー |
| [TypeScript](https://www.typescriptlang.org/) | v5 | 型安全な開発 |

#### 外部API

| サービス | 用途 |
|---|---|
| [ODPT（公共交通オープンデータセンター）](https://www.odpt.org/) | 鉄道駅・路線データの取得 |

### セットアップ

#### 前提条件

- pnpm >= 10.7.0
- Neon アカウント（開発用DBブランチの作成に必要）

#### インストール

```bash
git clone https://github.com/Natsugure/furatora.git
cd furatora
pnpm install
```

#### 環境変数

1. Neon コンソール（または Neon CLI / MCP）で、`main` ブランチから `development` ブランチを作成する
2. `.env.example` を参考に、以下の4ファイルを作成する。`DATABASE_URL` は `development` ブランチの接続文字列を使用する（プールド／直結の使い分けは `.env.example` のコメントを参照）

   | ファイル | 内容 |
   |---|---|
   | `apps/web/.env.local` | `DATABASE_URL`（プールド）, `NEXT_PUBLIC_GA_ID` |
   | `apps/admin/.env.local` | `DATABASE_URL`（プールド）, `AUTH_*`, `GEMINI_API_KEY` |
   | `apps/scripts/.env` | `DATABASE_URL`（直結）, `ODPT_API_KEY` |
   | `packages/database/.env` | `DATABASE_URL`（直結） |

#### 開発サーバーの起動

```bash
# DBスキーマの適用（Neon development ブランチへ）
pnpm run db:push

# 開発サーバーの起動
pnpm run dev
```

- フロントエンド: http://localhost:3000
- 管理画面: http://localhost:3001

#### データの再構築

`development` ブランチのデータを壊した場合は、Neon コンソール（または CLI/MCP）で
`main` ブランチから `development` ブランチを作り直す（コピーオンライトのため即時）。
その後、以下の手順で再構築する。

```bash
# 1. スキーマを適用
pnpm run db:push

# 2. マスタデータを投入
pnpm --filter scripts seed

# 3. ODPTから駅・路線データを取得
pnpm run update-odpt
```

ホーム・列車・停車位置・コンコース・設備は Admin での手入力データのため、
上記のコマンドでは復元されない。必要な範囲を Admin 画面から再入力する。

### 主要コマンド

```bash
pnpm run dev        # 全アプリの開発サーバーを起動
pnpm run build      # 全アプリのビルド
pnpm run lint       # リント実行
pnpm run db:push    # DBスキーマを適用
pnpm run db:studio  # Drizzle Studio（DB GUI）を起動
pnpm run update-odpt # ODPTから駅・路線データを取得・更新
```

### デプロイとマイグレーション

マイグレーションは Vercel のビルド時に、そのデプロイの接続先へ自動的に適用される。
`pnpm run db:migrate` を手で本番に流す運用は取らない。

Preview デプロイは PR ごとに Neon の `preview/<git-branch>` ブランチを持つ。
本番データのコピーに、その PR のスキーマを適用した状態で動作を確認できる。

**破壊的なマイグレーション（`DROP COLUMN` 等）は二段階に分ける。**
ビルド時にマイグレーションが走るため、稼働中の旧デプロイが新しいスキーマに直面する。

1. その列を読まないコードをデプロイする
2. 次のデプロイでマイグレーションが列を落とす

設計の根拠と却下した選択肢は
[ADR-0008](./docs/adr/0008-environment-database-branch-mapping.md) を参照。

#### 必要な設定

| 場所 | 設定 |
|---|---|
| Vercel: Storage → Connect Project → Advanced Options | Preview Branching を有効化 |
| Vercel: Settings → Build and Deployment | Build Command を `pnpm run db:migrate && turbo run build` に上書き |
| GitHub: リポジトリ変数 `NEON_PROJECT_ID` | Neon のプロジェクトID |
| GitHub: シークレット `NEON_API_KEY` | Neon の API キー |

GitHub 側の2つは、PR クローズ時に preview ブランチを削除する
`.github/workflows/cleanup-neon-preview.yml` が使用する。

---

## English

### Overview

**furatora** is a web application that provides information on barrier-free facilities (stroller/wheelchair-friendly elevators, restrooms, etc.) at Japanese railway stations and trains, along with transfer guidance for passengers with strollers or wheelchairs.

Users can visually check the locations of accessible facilities on platforms, transfer difficulty ratings, and the position of priority/free spaces within train cars.

### Key Features

- **Station Search** - Browse stations by railway line and operator
- **Platform View** - Visual display of train car positions and barrier-free facility locations on platforms
- **Transfer Difficulty** - Stroller/wheelchair accessibility ratings for transfers between lines
- **Facility Information** - Elevator and accessible restroom locations mapped to platform car positions
- **ODPT Integration** - Automatic station/railway data fetching via the Open Data for Public Transportation (ODPT) API

### Tech Stack

#### Monorepo Structure

| Directory | Description |
|---|---|
| `apps/web` | Frontend (end-user facing) |
| `apps/admin` | Admin data management panel |
| `apps/scripts` | Data fetching & seeding scripts |
| `packages/database` | DB client & schema definitions |
| `packages/typescript-config` | Shared TypeScript configuration |

#### Frontend

| Technology | Version | Purpose |
|---|---|---|
| [Next.js](https://nextjs.org/) | 16 (App Router) | Web framework |
| [React](https://react.dev/) | 19 | UI library |
| [Mantine](https://mantine.dev/) | v8 | UI component library |
| [TailwindCSS](https://tailwindcss.com/) | v4 | Utility-first CSS framework |
| [Lucide React](https://lucide.dev/) | - | Icons |

#### Backend / Database

| Technology | Version | Purpose |
|---|---|---|
| [DrizzleORM](https://orm.drizzle.team/) | v0.45 | Type-safe ORM |
| [PostgreSQL](https://www.postgresql.org/) | - | Relational database |
| [Neon](https://neon.tech/) | - | Serverless PostgreSQL (dev & production) |

#### Auth & Validation (Admin)

| Technology | Version | Purpose |
|---|---|---|
| [Auth.js (NextAuth)](https://authjs.dev/) | v5 | GitHub OAuth authentication |
| [Zod](https://zod.dev/) | v4 | Schema validation |

#### Development Tools

| Technology | Version | Purpose |
|---|---|---|
| [TurboRepo](https://turbo.build/) | v2 | Monorepo build system |
| [pnpm](https://pnpm.io/) | v10 | Package manager |
| [TypeScript](https://www.typescriptlang.org/) | v5 | Type-safe development |

#### External API

| Service | Purpose |
|---|---|
| [ODPT (Open Data for Public Transportation)](https://www.odpt.org/) | Railway station & line data |

### Setup

#### Prerequisites

- pnpm >= 10.7.0
- A Neon account (needed to create a development DB branch)

#### Installation

```bash
git clone https://github.com/your-username/furatora.git
cd furatora
pnpm install
```

#### Environment Variables

1. In the Neon console (or Neon CLI / MCP), create a `development` branch from `main`.
2. Create the following 4 files, using `.env.example` as a reference. `DATABASE_URL` should
   use the `development` branch connection string (see `.env.example` comments for which
   files need the pooled vs. direct connection).

   | File | Contents |
   |---|---|
   | `apps/web/.env.local` | `DATABASE_URL` (pooled), `NEXT_PUBLIC_GA_ID` |
   | `apps/admin/.env.local` | `DATABASE_URL` (pooled), `AUTH_*`, `GEMINI_API_KEY` |
   | `apps/scripts/.env` | `DATABASE_URL` (direct), `ODPT_API_KEY` |
   | `packages/database/.env` | `DATABASE_URL` (direct) |

#### Start Development Server

```bash
# Apply the database schema (to the Neon development branch)
pnpm run db:push

# Start development servers
pnpm run dev
```

- Frontend: http://localhost:3000
- Admin panel: http://localhost:3001

#### Rebuilding Data

If you break the data on the `development` branch, recreate it from `main` in the Neon
console (or CLI/MCP) — this is instant thanks to copy-on-write. Then rebuild with:

```bash
# 1. Apply the schema
pnpm run db:push

# 2. Seed master data
pnpm --filter scripts seed

# 3. Fetch station/line data from ODPT
pnpm run update-odpt
```

Platforms, trains, stop patterns, concourses, and facilities are manually entered via
Admin and are not restored by the commands above; re-enter the needed data through the
Admin UI.

### Common Commands

```bash
pnpm run dev         # Start dev servers for all apps
pnpm run build       # Build all apps
pnpm run lint        # Run linters
pnpm run db:push     # Apply DB schema
pnpm run db:studio   # Launch Drizzle Studio (DB GUI)
pnpm run update-odpt # Fetch & update station/line data from ODPT
```

### Deployment and migrations

Migrations are applied automatically during the Vercel build, against whichever branch
that deployment connects to. Never run `pnpm run db:migrate` against production by hand.

Each PR gets its own Neon `preview/<git-branch>` branch, so a preview deployment runs
the PR's schema against a copy of production data.

**Split destructive migrations (`DROP COLUMN` and the like) across two deploys.**
Migrations run during the build, so the still-running previous deployment faces the new
schema:

1. Deploy code that no longer reads the column.
2. Let the next deployment's migration drop it.

For the rationale and the rejected alternatives, see
[ADR-0008](./docs/adr/0008-environment-database-branch-mapping.md) (Japanese).

#### Required configuration

| Where | Setting |
|---|---|
| Vercel: Storage → Connect Project → Advanced Options | Enable Preview Branching |
| Vercel: Settings → Build and Deployment | Override Build Command with `pnpm run db:migrate && turbo run build` |
| GitHub repository variable `NEON_PROJECT_ID` | Neon project ID |
| GitHub secret `NEON_API_KEY` | Neon API key |

The two GitHub entries are used by `.github/workflows/cleanup-neon-preview.yml`, which
deletes the preview branch when a PR is closed.
