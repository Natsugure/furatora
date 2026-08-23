# ADR-0002: DBアクセスに ports パターンで依存性逆転を導入する

- **ステータス**: Proposed
- **日付**: 2026-08-14
- **決定者**: @Natsugure
- **関連**: [ADR-0001](./0001-layer-structure.md), [ADR-0003](./0003-read-write-separation.md), [ADR-0004](./0004-neon-branch-dev-environment.md)

---

## コンテキストと課題

[ADR-0001](./0001-layer-structure.md) で `features/` と `external/` の層を分けることを決めた。
残る問題は、**その境界をどの強度で守るか**である。

「`features/` から `external/` を呼ぶ」という素朴な層分けでは、
`features/` が `external/` の具体的な実装に依存する。
依存の向きを逆転させるか（ports パターン）、しないかを決める必要がある。

### 問題の実態: 既存テストが示すもの

`apps/admin/src/app/api/operators/route.test.ts` は、
現状で最も単純なクエリ `db.select().from().orderBy()` をテストしている。

```ts
const mockOrderBy = vi.fn().mockResolvedValue([mockOperator]);
const mockFrom = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
(db.select as Mock).mockReturnValue({ from: mockFrom });
```

**最小のクエリ1本のために3段のチェーンモックが必要**であり、
テストが「クエリビルダのメソッド呼び出し順序」に結合している。
`.where()` を1つ追加するだけで、振る舞いが同じでもテストが壊れる。

一方 `apps/web/src/app/stations/[slug]/page.tsx` は
**11テーブル・10クエリ・`innerJoin` / `leftJoin` / `inArray` / `Promise.all`** を含む。
同じ方式でのモックは現実的に維持不能であり、**実際にこのファイルにテストは1行も無い**。

### もう一つの制約: モジュール読み込み時の副作用

```ts
// packages/database/src/client.ts
if (!connectionString) { throw new Error('DATABASE_URL is not defined'); }
```

DBクライアントはモジュール読み込み時に throw する。
import チェーンがこれに到達するすべてのモジュールが、
テスト実行時に環境変数を要求することになる。

---

## 検討した選択肢

| | 内容 | テスタビリティ | コスト |
|---|---|---|---|
| **Level 1** | マッピング層のみ（DB行 → ドメイン型） | 純粋関数のみテスト可 | 小 |
| **Level 2** | + `db` を関数引数で注入 | 形式上は可能 | 小 |
| **Level 3** | + interface（ports）で依存性逆転 | 可能 | 中 |

---

## 決定

**Level 3 を採用する。**

```ts
// features/station/ports.ts — Drizzle も Next.js も知らない
import type { StationDetailDTO } from './domain/types';

export interface StationDetailQuery {
  getBySlug(slug: string): Promise<StationDetailDTO | null>;
}
```

```ts
// external/query/stationDetailQuery.ts — ここだけが Drizzle を知る
import { db } from '@furatora/database/client';
import type { StationDetailQuery } from '@/features/station/ports';

export const dbStationDetailQuery: StationDetailQuery = {
  async getBySlug(slug) {
    // 既存の fetchStationDetails() の実装をほぼそのまま持ち込める。
    // JOIN も Promise.all も生SQLも自由。DTOを返す契約だけ守る
  },
};
```

```ts
// features/station/usecases/getStationDetail.ts — ports のみに依存
export function makeGetStationDetail(deps: { query: StationDetailQuery }) {
  return async (slug: string) => { /* ... */ };
}
```

```ts
// src/di.ts — コンポジションルート。DIライブラリは使わない
import { dbStationDetailQuery } from '@/external/query/stationDetailQuery';
import { makeGetStationDetail } from '@/features/station/usecases/getStationDetail';

export const getStationDetail = makeGetStationDetail({ query: dbStationDetailQuery });
```

### 採用理由は「移植性」ではなく「テスタビリティ」である

**この点を取り違えると誤った実装になるため、明示的に記録する。**

当初、本決定は「将来 Hono へ移行する / Swift のモバイル版を作る際の
移植コストを下げるため」という理由で検討された。**この理由は成り立たない。**

| 主張 | 検証結果 |
|---|---|
| features が client を直接 import すると移植コストが高い | ❌ 移植性を決めるのは**パッケージ配置**と**Next.js非依存性**。interface の有無は無関係 |
| Hono 移行時に Drizzle の抽象化が効く | ❌ 移行で書き換わるのはHTTP層であり、interface の有無は影響しない（ただし注記参照） |
| Swift のモバイル版に備えられる | ❌ Swift は TypeScript の型もinterfaceも共有しない。HTTPで話す。必要なのはAPI境界であってRepository境界ではない |

> **注記**: `packages/database/src/client.ts` は `drizzle-orm/neon-http` に加えて
> `import 'dotenv/config'` と `import postgres from 'postgres'` を無条件に
> トップレベルで import している（`USE_LOCAL_DB` による分岐は import 後）。
> Cloudflare Workers 等の非Node環境では `nodejs_compat` 相当の対応を要するため、
> 「そのまま動作する」は不正確である。本ADRの結論は変わらないが根拠として訂正する。
> なお `postgres` への依存は [ADR-0004](./0004-neon-branch-dev-environment.md) /
> [ADR-0005](./0005-write-atomicity-driver.md) により削除される。

移植性は [ADR-0001](./0001-layer-structure.md) の**依存ルール**（`features/*/{domain,ports,usecases}` と
`external/` が `next/*` を import しない）と、
[ADR-0003](./0003-read-write-separation.md) の **DTO制約**（APIレスポンス契約として
そのまま通用する形にする）によって担保される。
本ADRが解決するのは以下の2点である。

1. **テスタビリティ** — Drizzle のチェーンモックを書かずにテストできる
2. **ドメインとデータモデルの乖離への耐性** — 乗換案内（経路探索）等、
   1つのドメイン操作が複数テーブル・複数データソースにまたがる機能を
   今後追加する際の受け皿になる

### 本決定の前提条件

**本決定はテスタビリティのみを根拠としている。** したがってテストが実際に書かれなければ、
本決定は根拠を失ったまま追加ファイル約12個のコストだけを残す。

テスト基盤の現状（2026-08-15 時点の実測）は以下の通り。

| | vitest設定 | `test` script | 既存テスト |
|---|---|---|---|
| `apps/admin` | ✅ `vitest.config.ts` | ✅ `vitest run` | 4ファイル |
| `apps/web` | ❌ **無し** | ❌ **無し** | **0** |

[ADR-0003](./0003-read-write-separation.md) により Query Service の適用先は
`apps/web` の `platform` / `station` である。つまり本決定は
**テスト基盤が存在しないアプリに、テスタビリティを根拠とする抽象を導入する**ことになる。

本ADRは前提条件として以下を要求する。
**成果物の定義・見積り・スケジュールは本ADRを根拠とする別Issueに委ねる**（ADRは判断を記録するものであり、作業計画を規定しない）。

1. `apps/web` にテスト実行環境が存在すること
2. 導入した port に対し、Fake を注入した usecase のテストが少なくとも1つ存在すること

**前提条件が満たされないまま Issue #29 がマージされた場合、本ADRは
Level 1（マッピング層のみ）へ差し戻す。** 抽象だけを残す選択はしない。
`docs/spec/design.md` のテスト戦略が全項目手動のままである点も、
この前提条件と整合させる必要がある。

---

## 各選択肢の評価

### Level 1: マッピング層のみ

- **良い点**: 追加コストが最小。UIからDrizzle型を排除する目的は達成できる
- **悪い点**: クエリ関数が `db` を直接 import するため、テストは
  `vi.mock('@furatora/database/client')` に依存し続ける
- **却下理由**: 目的の半分（型の漏れ）しか解決しない

### Level 2: `db` を引数注入

```ts
export async function fetchStationDetail(slug: string, db: Db = defaultDb) { ... }
```

- **良い点**: 追加コストがほぼゼロ。singleton 依存を外せる
- **悪い点**: **注入できる Fake を作ること自体が現実的でない。**
  上記 `operators/route.test.ts` の実例の通り、Drizzle のクエリビルダは
  チェーン構造のため、Fake がクエリの呼び出し順序を再現する必要がある。
  10クエリ + JOIN のページでは維持不能
- **却下理由**: 「テストできる」が形式的なものに留まり、実際にはテストが書かれない。
  現状の `stations/[slug]/page.tsx` にテストが無いのがその証拠

### Level 3: ports による依存性逆転（採用）

- **良い点**:
  - Fake が `{ getBySlug: async () => fixture }` の1行で済む
  - `external/` 以外が `client.ts` の環境変数 throw から解放される
  - 実装側（`external/`）は JOIN も生SQLも自由に使え、性能最適化を阻害しない
- **悪い点**:
  - 追加ファイル約12（`ports.ts` / `usecases/` / `di.ts`）
  - interface の設計判断が必要。**推測で設計すると負債になる**（後述）

---

## 結果

### 肯定的な結果

- `stations/[slug]/page.tsx` 相当のロジックにテストが書けるようになる
- Issue #29 のスキーマ変更の影響が `external/query/` に閉じる
- 乗換案内など、複数テーブルにまたがるドメインロジックの受け皿ができる

### 否定的な結果・受け入れるトレードオフ

- Issue #29 に **+2〜3日**（ADR-0001 と合算）
- 小さな読み取り追加でも `ports.ts` / `external/` / `di.ts` の3箇所を触る

### 実装上の禁止事項

**port を推測で設計してはならない。** 実在する画面・ユースケースに対してのみ定義する。
乗換案内など未実装機能のための port を先回りして作らないこと
（要件が判明していない段階で設計した抽象は、ほぼ確実に間違っている）。

具体的な禁止形については [ADR-0003](./0003-read-write-separation.md) を参照。

### DIライブラリを使わない

`src/di.ts` でファクトリ関数を手動配線する。
InversifyJS / tsyringe 等のDIコンテナは導入しない。

理由: 配線対象が数個であり、デコレータやメタデータリフレクションの導入コストに見合わない。
コンテナが必要になるほど配線が増えた時点で再検討する（その時点で本ADRを supersede する）。

### 適用範囲

Issue #29 では `platform` / `station` / `stop-pattern` の3feature に限定する
（[ADR-0001](./0001-layer-structure.md) の対象範囲に準じる）。

### 見直し条件

以下のいずれかが観測された場合、本ADRを再評価する。

- `ports.ts` の維持コストが、それによって書かれたテストの価値を上回っていると判断されたとき
- port の実装が `external/query/` 以外に増えないまま6ヶ月以上経過し、
  かつテストも書かれていないとき（＝抽象が機能していない証拠）
