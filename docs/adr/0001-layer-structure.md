# ADR-0001: 4層構成（app / features / shared / external）と依存ルール

- **ステータス**: Proposed
- **日付**: 2026-08-14
- **決定者**: @Natsugure
- **関連**: [ADR-0002](./0002-dependency-inversion-ports.md), [ADR-0003](./0003-read-write-separation.md)

---

## コンテキストと課題

`apps/web` と `apps/admin` は、Next.js App Router の標準構成
（`app/` + `components/` + `lib/` + `constants/`）のまま成長してきた。
その結果、以下の状態にある（2026-08-14 時点の実測）。

### 実測値

| 項目 | 値 |
|---|---|
| `@furatora/database` を import しているファイル | **58**（web 12 / admin 46） |
| うち **UIコンポーネント**（`components/` 配下） | **8** |
| `apps/web/src/app/stations/[slug]/page.tsx` | 485行（うち約250行がDB組み立て） |
| `apps/web/src/components/TrainVisualization.tsx` | 1,005行 |
| `apps/admin/src/app/unresolved-connections/page.tsx` | 556行 |

### 具体的な問題

**1. Drizzle の型がUIコンポーネントまで漏れている**

```ts
// apps/web/src/components/PlatformTabs.tsx:5
import type { CarStopPosition, CarStructure, FreeSpace, PrioritySeat } from '@furatora/database/schema';
```

Issue #29 は `platformCarStopPositions` テーブルを削除し、
`maxCarCount` → `physicalLength`、`nearPlatformCell` → `xPositionMeters` へ
置き換えるスキーマ変更を含む。上記の import はこの変更で直接破壊される。
**スキーマ変更のたびにUIが壊れる構造**になっている。

**2. `page.tsx` / `route.ts` にデータ組み立てロジックが埋まっている**

`stations/[slug]/page.tsx` の `fetchStationDetails()` は11テーブルを
横断する約250行の関数で、ページコンポーネントと同一ファイルにある。
テストを書く手段が無く、実際にテストは存在しない。

**3. 表示用の型の置き場が規約として決まっていない**

`apps/web` は既に公開API `/api/v1/*`（stations / operators / lines の4エンドポイント）を持つ。
そのレスポンス型は `src/types/index.ts` に手書きのDTOとして定義されており
（`StationSearchApiResponse` / `OperatorsApiResponse` / `LineStationsApiResponse`）、
**Drizzle 非依存**で、本ADRが目指す形に既に近い。

しかし規約が無いため、同じ「表示用の型」が3箇所に分散している。

| 置き場 | 実例 |
|---|---|
| `src/types/index.ts`（Drizzle非依存・DTO） | `StationSearchApiResponse` |
| `route.ts` でDrizzle行を無加工で返す | `api/v1/stations/[id]/route.ts` は `db.select().from(stations)` の結果を そのまま `NextResponse.json()` している |
| `page.tsx` にインライン | `stations/[slug]/page.tsx` の `fetchStationDetails()` の戻り値型 |

2つ目が特に問題で、**スキーマのカラム名がそのまま公開APIの契約になっている**。
`stations` テーブルは Issue #29 の変更対象外のため現時点で実害は出ていないが、
スキーマ変更が予告なく公開APIを壊しうる構造は残る。

---

## 検討した選択肢

1. **現状維持（`app/` + `components/` + `lib/`）**
2. **技術レイヤー分割**（`repositories/` `services/` `controllers/` をトップレベルに置く）
3. **4層 + featureベース分割**（`app/` / `features/` / `shared/` / `external/`）← 採用

---

## 決定

**選択肢3を採用する。**

```
apps/{web,admin}/src/
├── app/          # ルーティング。Next.js固有APIを使ってよい唯一の場所（+ components）
├── features/     # ドメイン単位の機能群。ここが保護対象
├── shared/       # feature横断の汎用UI・ユーティリティ
└── external/     # 外部世界（DB・外部API）との接続。実装の詳細
```

`features/` 配下はドメイン単位で切る（技術レイヤー単位では切らない）。

```
features/platform/
├── domain/          # 型定義 + 純粋ロジック（geometry.ts 等）
├── ports.ts         # インターフェース定義（ADR-0002）
├── usecases/        # ports のみに依存するアプリケーションロジック
└── components/      # このfeature専用のUI
```

### 依存ルール

```
        app/  ──────►  features/  ──────►  shared/
      (routing)      (ドメイン + UI)        (汎用)
                          ▲
                          │ implements（依存が逆転する。ADR-0002）
                          │
                     external/  ──►  @furatora/database / 外部API
```

| 場所 | `next/*` | `drizzle-orm` / `@furatora/database` |
|---|---|---|
| `app/` | ✅ | ❌ |
| `features/*/domain/`, `ports.ts`, `usecases/` | ❌ | ❌ |
| `features/*/components/` | ✅ | ❌ |
| `shared/` | ✅ | ❌ |
| `external/` | ❌ | ✅ |

補足ルール:

- `shared/` は `features/` を import しない（逆方向のみ）
- `app/` にビジネスロジックを書かない。クエリ呼び出しとJSXの合成のみ
- feature 間の依存は以下のみ許可する。循環は禁止

  | from ↓ / to → | platform | station | stop-pattern |
  |---|---|---|---|
  | **platform** | — | ❌ | ❌ |
  | **station** | ✅ | — | ✅ |
  | **stop-pattern** | ✅ | ❌ | — |

  `platform` を最下層に置く。`stop-pattern` は停車位置をホーム原点からの
  メートル座標で表現するため `platform` の座標系に依存する。
  `station` は両者を束ねる上位に位置する。

### ESLint による機械的強制

**この決定の実効性はESLintに依存する。** 規約を人間の注意力で守る運用は破綻する。

#### 構成: 共有パッケージ + 各アプリの設定ファイル

現状、ESLint設定はリポジトリルートの `eslint.config.mjs` 1つのみで、
各アプリの `lint`（`eslint src/`）は祖先探索でこれを拾っている。
この構成では **flat config の `files` グロブが設定ファイルの位置を基準に解決される**ため、
`files: ['src/app/**']` は `apps/web/src/app/**` にマッチしない。
**ルールが1件も適用されないまま lint が成功する。**

そこで Turborepo 推奨の「共有configパッケージ + 各アプリの薄い設定ファイル」を採る。
これは本リポジトリが `@furatora/typescript-config` で既に採用している形と同一であり、
新しい概念を持ち込まない。

```
packages/eslint-config/
├── package.json        # @furatora/eslint-config
├── base.mjs            # 全パッケージ共通
└── next-app.mjs        # 4層の依存ルール（下記）を含む

apps/web/eslint.config.mjs     # 薄い合成のみ
apps/admin/eslint.config.mjs   # 薄い合成のみ
```

```js
// apps/web/eslint.config.mjs
import nextApp from '@furatora/eslint-config/next-app';

export default [
  ...nextApp,
  // 移行中の除外は「各アプリ側」に置く。共有パッケージには置かない
  { files: ['src/components/**'], rules: { 'no-restricted-imports': 'off' } },
];
```

各アプリに設定ファイルが物理的に存在することで `files: ['src/app/**']` が意図通り解決される。
除外リストはアプリごとに異なる速度で減っていくため、共有側に置くと
一方の移行完了が他方の都合で妨げられる。

> 参考にした [Turborepo のハンドブック](https://turbo.build/repo/docs/handbook/linting/eslint)は
> `.eslintrc` 形式（`extends: ["custom/next"]`）で書かれている。
> 本リポジトリは ESLint 9 / flat config のため `extends` は使えず配列展開になる。
> **構成のみ踏襲し、記法は読み替える。**

#### 依存ルール本体

```js
// packages/eslint-config/next-app.mjs
{
  files: ['src/app/**', 'src/shared/**', 'src/features/*/components/**'],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [{
        // ワイルドカードにせず列挙する。`@furatora/database/enums` を
        // 意図的に除外するため（後述）。exports は client / schema / enums の3つのみ
        group: ['@furatora/database', '@furatora/database/client', '@furatora/database/schema', 'drizzle-orm'],
        message: 'DBアクセスは external/ に限定してください（ADR-0001）',
      }],
    }],
  },
},
{
  files: ['src/features/*/domain/**', 'src/features/*/usecases/**', 'src/features/*/ports.ts', 'src/external/**'],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [{
        group: ['next', 'next/*'],
        message: 'この層はNext.js非依存を保ってください（ADR-0001）',
      }],
    }],
  },
}
```

既存58ファイルを一度に移行しないため、移行完了までは除外設定を併用し、
段階的に除外リストを削る。

#### `@furatora/database/enums` の扱い

`packages/database/src/enums.ts` は Drizzle も runtime も含まない
純粋な TypeScript の union 型のみのファイルであり
（`StrollerDifficulty` / `WheelchairDifficulty` / `DirectionType` / `PlatformSide`）、
スキーマ型の漏れとは性質が異なる共有語彙である。

**当面は例外として許可する**（上記の制限パターンをワイルドカードにせず
`client` / `schema` の列挙にしているのはこのため）。
`packages/` 配下の独立パッケージへ切り出すかは、本ADRを根拠とする別Issueで扱う。

#### ルールが発火することの検証

**設定した時点で必ず確認する。** 「違反ゼロで通った」状態と
「ルールが適用されていない」状態は、lintの出力上まったく区別がつかない。

1. `apps/web/src/app/` 配下に `import { db } from '@furatora/database/client';` を含む一時ファイルを置く
2. `pnpm run lint` が**そのファイルでエラーになる**ことを確認する
3. 一時ファイルを削除する

`apps/admin` でも同様に確認する。この検証をIssueの完了条件に含める。

---

## 各選択肢の評価

### 選択肢1: 現状維持

- **良い点**: コストゼロ
- **悪い点**: Issue #29 のスキーマ変更が58ファイルに波及する。今後
  乗換案内・駅内まとめページを追加すると悪化する一方
- **却下理由**: 問題が Issue #29 の作業量として顕在化しており、先送りできない

### 選択肢2: 技術レイヤー分割

- **良い点**: レイヤーの責務が明快
- **悪い点**: 1つの機能追加が `repositories/` `services/` `controllers/`
  の全ディレクトリに分散し、関連コードが遠くなる。
  機能削除時に取り残しが発生しやすい
- **却下理由**: furatora はドメイン（駅・ホーム・列車・設備）が明確に分かれており、
  ドメイン単位の凝集を優先する方が変更が局所化する

### 選択肢3: 4層 + featureベース分割（採用）

- **良い点**:
  - 1機能の変更が1ディレクトリに収まる
  - `features/*/{domain,ports,usecases}` と `external/` が Next.js 非依存になるため、
    将来 `apps/api`（Hono等）が必要になった際、**そのまま `packages/core` へ移動できる**
  - ESLintで機械的に強制できる境界が引ける
- **悪い点**:
  - 層が増える分、小さな変更でも触るファイルが増える
  - feature の粒度判断が必要（境界が曖昧なコードの置き場に迷う）

---

## 結果

### 肯定的な結果

- スキーマ変更の影響範囲が `external/` に閉じる
- `features/*/domain/` の純粋関数（`geometry.ts` の `computeBounds()` 等）が
  DB非依存になり、Vitestで単体テストできる
- `packages/core` への抽出パスが確保される

### 否定的な結果・受け入れるトレードオフ

- Issue #29 に **+2〜3日** の追加コスト（ADR-0002 と合算）
- 移行完了までESLintの除外設定を維持する必要があり、その期間は
  新旧2つの構造が同居する

### 対象範囲

Issue #29 では **`platform` / `station` / `stop-pattern` の3feature に限定**する。
残り（`search` / `line` / `transfer` / admin側全般）は後続Issueとする。
`apps/admin/src/app/unresolved-connections/page.tsx`（556行）は別Issue。

### `packages/core` の抽出について

**今回は物理的な抽出を行わない。** 依存ルールをESLintで強制するに留め、
実際の抽出は `apps/api` が必要になった時点で行う。

理由: 抽出作業自体はimportパスの機械的な変更であり、後回しにしても
コストが増えない。一方、依存ルールを後回しにすると違反が蓄積し、
抽出時に大量の修正が必要になる。**守るべきはルールであって配置ではない。**

### 参考にした外部資料との差異

本構成は [Next.js App Router のアーキテクチャ記事](https://zenn.dev/yukionishi/articles/cd79e39ea6c172)
の4層構成を参考にしているが、以下の点が異なる。

| 項目 | 参考記事 | 本ADR |
|---|---|---|
| ビジネスロジックの位置 | `external/service/` | **`features/*/domain/` `usecases/`** |
| 層の分離手段 | ディレクトリ規約 + ESLint | + **interfaceによる依存性逆転**（ADR-0002） |
| クライアント層 | TanStack Query + Container/Presenter | **不採用**（web はRSC中心でデータ取得ゼロ） |

**参考記事の "external" は「Reactの外側」の意味**であり、ビジネスロジックを含む。
本ADRの `external/` は「実装の詳細」の意味で、ドメインは `features/` 側に置く。
軸が異なるため、記事の構成をそのまま採用していない点に注意。

なお、本ADRは Clean Architecture の実装ではない。
用語（Entity / Interactor / Boundary 等）も採用しない。
**従うべきは上記の依存ルールそのものであり、特定のアーキテクチャ名ではない。**
