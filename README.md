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
| [Neon](https://neon.tech/) | - | サーバーレスPostgreSQL（本番環境） |
| [Docker](https://www.docker.com/) | - | ローカル開発DB環境 |

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
- Docker（ローカルDB用）

#### インストール

```bash
git clone https://github.com/Natsugure/furatora.git
cd furatora
pnpm install
```

#### 環境変数

`.env.local` を作成し、以下の変数を設定してください。

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/main
```

管理画面（`apps/admin`）を使用する場合は追加で設定が必要です。

```env
AUTH_SECRET=your_secret
AUTH_GITHUB_ID=your_github_oauth_app_id
AUTH_GITHUB_SECRET=your_github_oauth_app_secret
```

#### 開発サーバーの起動

```bash
# ローカルDBの起動
docker compose up -d

# DBスキーマの適用
pnpm run db:push

# 開発サーバーの起動
pnpm run dev
```

- フロントエンド: http://localhost:3000
- 管理画面: http://localhost:3001

### 主要コマンド

```bash
pnpm run dev        # 全アプリの開発サーバーを起動
pnpm run build      # 全アプリのビルド
pnpm run lint       # リント実行
pnpm run db:push    # DBスキーマを適用
pnpm run db:studio  # Drizzle Studio（DB GUI）を起動
pnpm run update-odpt # ODPTから駅・路線データを取得・更新
```

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
| [Neon](https://neon.tech/) | - | Serverless PostgreSQL (production) |
| [Docker](https://www.docker.com/) | - | Local development database |

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
- Docker (for local database)

#### Installation

```bash
git clone https://github.com/your-username/furatora.git
cd furatora
pnpm install
```

#### Environment Variables

Create a `.env.local` file with the following variables:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/main
```

For the admin panel (`apps/admin`), additional variables are required:

```env
AUTH_SECRET=your_secret
AUTH_GITHUB_ID=your_github_oauth_app_id
AUTH_GITHUB_SECRET=your_github_oauth_app_secret
```

#### Start Development Server

```bash
# Start local database
docker compose up -d

# Apply database schema
pnpm run db:push

# Start development servers
pnpm run dev
```

- Frontend: http://localhost:3000
- Admin panel: http://localhost:3001

### Common Commands

```bash
pnpm run dev         # Start dev servers for all apps
pnpm run build       # Build all apps
pnpm run lint        # Run linters
pnpm run db:push     # Apply DB schema
pnpm run db:studio   # Launch Drizzle Studio (DB GUI)
pnpm run update-odpt # Fetch & update station/line data from ODPT
```
