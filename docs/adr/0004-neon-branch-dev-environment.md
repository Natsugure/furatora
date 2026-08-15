# ADR-0004: 開発環境を Neon ブランチに統一し、ローカル PostgreSQL / Docker を廃止する

- **ステータス**: Proposed
- **日付**: 2026-08-15
- **決定者**: @Natsugure
- **関連**: [ADR-0002](./0002-dependency-inversion-ports.md), [ADR-0003](./0003-read-write-separation.md), [ADR-0005](./0005-write-atomicity-driver.md)

---

## コンテキストと課題

開発環境は Docker 上のローカル PostgreSQL、本番は Neon という構成になっている。
`packages/database/src/client.ts` が環境変数 `USE_LOCAL_DB` で
ドライバを切り替えることで両者を吸収している。

```ts
export const db = process.env.USE_LOCAL_DB === 'true' ?
  drizzlePg({ client: postgres(connectionString), schema: schema }) :
  drizzleHttp({ client: neon(connectionString), schema: schema });
```

### 問題1: 開発環境と本番環境でトランザクションの挙動が異なる

`drizzle-orm@0.45.1` の実装を確認した結果は以下の通り。

| ドライバ | `db.transaction()` |
|---|---|
| `postgres-js`（`USE_LOCAL_DB=true`／開発） | ✅ 動作する |
| `neon-http`（既定／本番） | ❌ `throw new Error("No transactions support in neon-http driver")` |

```
drizzle-orm/neon-http/session.cjs:177
  async transaction(_transaction, _config = {}) {
    throw new Error("No transactions support in neon-http driver");
```

**開発環境で正常に動作したトランザクションが、本番で実行時例外になる。**
型検査もビルドも通るため、実行するまで検出できない。

### 問題2: `USE_LOCAL_DB` はフラグ名が実態を偽っている

`.github/workflows/update-odpt.yml` は、**本番の `DATABASE_URL` に対して**
`USE_LOCAL_DB: 'true'` を設定している。

```yaml
env:
  DATABASE_URL: ${{ secrets.DATABASE_URL }}
  USE_LOCAL_DB: 'true'
```

`apps/scripts/src/update-odpt.ts:151` が `db.transaction()` を使うため、
neon-http では動作しないからである。

つまり `USE_LOCAL_DB` の実態は「ローカルDBを使うか」ではなく
**「postgres-js ドライバを使うか」**であり、
本番に対してトランザクションを通すための回避策として使われている。
名前が実態を隠しており、この行を消すと日次のODPT更新が壊れる。

なおこの事実は、**postgres-js が Neon に対して問題なく接続できる**ことの
実証にもなっている（後述の移行の安全性の根拠）。

### 問題3: Docker イメージの維持コストが根拠を失っている

`docker/Dockerfile.postgres` の実体は、`postgres:17` に `pg_uuidv7` 拡張を
ソースからビルドして入れるだけのものである。

```dockerfile
FROM postgres:17
RUN apt-get update && apt-get install -y build-essential git postgresql-server-dev-17 ...
RUN git clone https://github.com/fboulnois/pg_uuidv7.git /tmp/pg_uuidv7 && cd /tmp/pg_uuidv7 && make && make install ...
COPY init.sql /docker-entrypoint-initdb.d/
```

`docker/init.sql` は2行（`CREATE EXTENSION IF NOT EXISTS pg_uuidv7;`）のみ。
`packages/database/src/schema.ts` は全テーブルの主キーが
`.default(sql\`uuid_generate_v7()\`)` であるため、この拡張は必須である。

一方 **Neon は `pg_uuidv7` を PG14〜17 で標準サポートしている**（v1.6）。
このイメージが存在する唯一の理由は、Neon 側では最初から解決されている。

### 制約

- 開発者は1人であり、スキーマ変更の競合は発生しない
- **オフラインでの開発を行う状況は無い**（開発者確認済み・2026-08-15）
- `apps/web` は書き込みを持たない（[ADR-0003](./0003-read-write-separation.md)）

---

## 検討した選択肢

1. **現状維持**（Docker + postgres-js、本番は neon-http）
2. **Neon の development ブランチ + Neon Local Connect**（ローカルにプロキシを立てる）
3. **Neon の development ブランチに直結し、Docker を廃止する** ← 採用

---

## 決定

**選択肢3を採用する。**

開発環境は Neon 上に作成した `development` ブランチへ直接接続し、
ローカル PostgreSQL / Docker 構成を廃止する。

### 変更内容

| 対象 | 変更 |
|---|---|
| `docker/Dockerfile.postgres` | 削除 |
| `docker/init.sql` | 削除 |
| `docker-compose.yml` | 削除 |
| `README.md` | `docker compose up -d` の手順を削除し、Neon ブランチの接続手順へ差し替え（日本語・英語の両セクション） |
| `packages/database/src/client.ts` | `USE_LOCAL_DB` 分岐を削除。ドライバ構成は [ADR-0005](./0005-write-atomicity-driver.md) で決定する |
| `packages/database` の `postgres` 依存 | 削除 |
| `.github/workflows/update-odpt.yml` | `USE_LOCAL_DB: 'true'` を削除 |

### 環境ごとの接続先

| 環境 | Neon ブランチ | `DATABASE_URL` の出所 |
|---|---|---|
| ローカル開発 | `development` | 各開発者の `.env` |
| GitHub Actions（`update-odpt`） | `main`（本番） | `secrets.DATABASE_URL` |
| 本番（Vercel） | `main` | Vercel 環境変数 |

### `USE_LOCAL_DB` を単純に消してはならない

**この分岐は現在 load-bearing である。**
先に消すと `update-odpt` の `db.transaction()` が本番で throw する。

削除は [ADR-0005](./0005-write-atomicity-driver.md) のドライバ決定と
**同一のPRで行う**こと。順序は以下とする。

1. ADR-0005 のトランザクション用クライアントを追加する
2. `update-odpt.ts` をそれに移行する
3. `USE_LOCAL_DB` 分岐とワークフローの環境変数を削除する

### スキーマ適用とデータ再構築

`pnpm run db:push` の適用先が Neon の `development` ブランチになる。
データを壊した場合は、ローカルの `docker compose down -v` に相当する操作として
**`main` ブランチから `development` ブランチを作り直す**。
Neon のブランチはコピーオンライトで即時作成されるため、
従来のイメージ再ビルドより短時間で復旧できる。

`apps/scripts/src/seed-master-data.ts` および `pnpm run update-odpt` による
再構築手順は README に記載する。

---

## 各選択肢の評価

### 選択肢1: 現状維持

- **良い点**: 変更コストゼロ。オフラインで開発できる
- **悪い点**:
  - 問題1（開発と本番でトランザクションの挙動が異なる）が残り続ける
  - `pg_uuidv7` ビルド用の Dockerfile を維持し続ける
  - ローカル PostgreSQL の低レイテンシが N+1 の痛みを隠す。
    [ADR-0003](./0003-read-write-separation.md) が N+1 解消を掲げているのに、
    開発環境では問題が体感できない
- **却下理由**: 唯一の実質的な利点であるオフライン開発が、本プロジェクトでは不要

### 選択肢2: Neon ブランチ + Neon Local Connect

- **良い点**: 接続先を Neon に統一しつつ、ローカルからは固定のローカルURLで接続できる
- **悪い点**: プロキシという構成要素が増える。
  Docker を捨てる動機が「維持する構成要素を減らすこと」であるのに、別の常駐物が入る
- **却下理由**: オフライン開発が不要なため、プロキシを挟む理由が無い

### 選択肢3: Neon ブランチに直結（採用）

- **良い点**:
  - 開発・CI・本番のすべてが同一のDBエンジンと同一ドライバになり、問題1が消える
  - `pg_uuidv7` が Neon 標準サポートのため、Dockerfile ごと不要になる
  - `client.ts` から `import postgres from 'postgres'` が消える。
    これは [ADR-0002](./0002-dependency-inversion-ports.md) の注記で指摘した
    「非Node環境で `nodejs_compat` を要する」原因だったため、同時に解消する
  - **開発環境でネットワーク往復のレイテンシが可視化される。**
    `apps/admin/src/app/stations/page.tsx:16-33` の N+1 が体感できるようになり、
    ADR-0003 の N+1 解消の動機づけになる
- **悪い点**:
  - オフラインで開発できない
  - すべてのクエリにネットワーク往復が入り、開発時の体感速度は低下する

---

## 結果

### 肯定的な結果

- 開発環境で動いたトランザクションが本番で throw する事故が構造的に発生しなくなる
- 維持対象から Dockerfile・docker-compose.yml・`postgres` 依存が消える
- N+1 と過剰なクエリ往復が開発中に露見するようになる

### 否定的な結果・受け入れるトレードオフ

- **オフラインで開発できない。** 開発者が1人であり、
  オフライン開発の必要が無いことを確認した上で受け入れる
- **開発時のページ表示が遅くなる。**
  `stations/[slug]/page.tsx` は10クエリを発行するため、
  ローカル PostgreSQL と比べて明確に遅くなる。
  これは選択肢3の「良い点」の裏返しであり、意図的に受け入れる
- Neon の無料枠（ブランチ数・ストレージ・コンピュート時間）を消費する

### 適用範囲

本ADRは開発環境の接続先とローカル構成の廃止のみを決定する。
**どのドライバを使うか、書き込みの原子性をどう担保するかは
[ADR-0005](./0005-write-atomicity-driver.md) で決定する。**

### 見直し条件

- 開発者が複数人になり、`development` ブランチのスキーマ変更が競合するようになったとき
  （Neon のブランチを開発者ごとに分ける運用を検討する）
- オフラインでの開発が必要になったとき（選択肢2を再評価する）
- Neon の無料枠を超過し、開発用ブランチの維持コストが問題になったとき
