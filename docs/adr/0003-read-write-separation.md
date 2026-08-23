# ADR-0003: 読み取りと書き込みで異なる抽象を用いる（Query Service / Repository）

- **ステータス**: Proposed
- **日付**: 2026-08-14
- **決定者**: @Natsugure
- **関連**: [ADR-0001](./0001-layer-structure.md), [ADR-0002](./0002-dependency-inversion-ports.md), [ADR-0005](./0005-write-atomicity-driver.md)

---

## コンテキストと課題

[ADR-0002](./0002-dependency-inversion-ports.md) で、`features/*/ports.ts` に
interface を定義し `external/` で実装することを決めた。

残る問題は、**その interface をどの粒度で切るか**である。
安直に Repository パターン（集約単位・エンティティを返す）を全面採用すると、
furatora の実態に対して深刻な性能問題を引き起こす。

### 問題1: 表示に必要なデータに対応する「集約」が存在しない

`apps/web/src/app/stations/[slug]/page.tsx` が必要とするデータは、
以下の**11テーブル**にまたがる。

```
stations / lines / platforms / trains / trainCarStructures / trainEquipments /
platformLocations / platformLocationCells / stationFacilities /
facilityConnections / stationConnections
```

これに対応する集約は存在しない。集約単位の Repository で表現しようとすると、

- 集約ごとに `findBy...()` を呼ぶ → N+1 が発生する
- あるいは全部入りの「駅集約」をでっち上げる → 書き込み側で扱えない代物になる

のいずれかになる。

### 問題2: N+1 は既に実在している

```ts
// apps/admin/src/app/stations/page.tsx:16-33
const lineStations = await Promise.all(
  lineList.map(async (line) => {
    const stns = await db.select({ ... })
      .from(stationLines)
      .innerJoin(stations, eq(stationLines.stationId, stations.id))
      .where(eq(stationLines.lineId, line.id))     // ← 路線数ぶんクエリが飛ぶ
      .orderBy(asc(stationLines.stationOrder));
    return { line, stations: stns };
  })
);
```

汎用 Repository を導入すると、この形が**構造的に強制される**ようになる。

### 問題3: 読み書きの比率がアプリごとに大きく異なる

| | 読み取り | 書き込み |
|---|---|---|
| `apps/web` | すべて | **無し**（公開閲覧アプリ） |
| `apps/admin` | 一覧・編集フォーム初期表示 | 14フォーム |

`apps/web` は書き込みを一切持たない。
一方 `apps/admin` は読み取りも大量に持つ（`stations/page.tsx`、各 `edit/page.tsx` 等）。

つまり **「web = 読み / admin = 書き」という分割は成立しない。**

---

## 検討した選択肢

1. **Repository で統一する**（読み書き両方を集約単位のRepositoryで扱う）
2. **アプリ単位で分ける**（web = Query、admin = Repository）
3. **操作の方向で分ける**（読み = Query Service、書き = Repository）← 採用

---

## 決定

**選択肢3を採用する。** 抽象を分ける軸は「アプリ」ではなく「読み取り / 書き込み」とする。

```
                  読み取り            書き込み
              ┌──────────────┬──────────────┐
  apps/web    │ Query Service │     無し      │
              ├──────────────┼──────────────┤
  apps/admin  │ Query Service │  Repository   │  ← 両方持つ
              └──────────────┴──────────────┘
```

### 2つの抽象の違い

| | Repository | Query Service |
|---|---|---|
| 粒度 | **集約（Aggregate）** 1つ | **画面・ユースケース** 1つ |
| 戻り値 | ドメインエンティティ | **DTO**（表示用に整形済み） |
| メソッド | `save` / `findById` / `delete` | `getStationDetailBySlug()` など目的別に1〜2個 |
| JOIN | 集約の外には出られない | **何テーブルでも自由。生SQLも可** |
| 存在理由 | 不変条件を守って永続化する | 画面が必要なデータを最小クエリで取る |
| 使用クライアント | `withTransaction`（[ADR-0005](./0005-write-atomicity-driver.md)） | `db`（neon-http） |

> **注意**: 既定の `neon-http` ドライバは `db.transaction()` が実行時例外になるため、
> Repository を定義しただけでは不変条件を守れない。
> 原子性の担保手段は [ADR-0005](./0005-write-atomicity-driver.md) で決定している。

```ts
// ❌ 禁止: 汎用CRUD Repository（読み取りに使うと N+1 を強制する）
export interface PlatformRepository {
  findAll(): Promise<Platform[]>;
  findById(id: string): Promise<Platform | null>;
  findByStationId(stationId: string): Promise<Platform[]>;
}

// ✅ 読み取り: Query Service（画面単位・DTOを返す・内部実装は自由）
export interface StationDetailQuery {
  getBySlug(slug: string): Promise<StationDetailDTO | null>;
}

// ✅ 書き込み: Repository（集約単位）
export interface StopPatternRepository {
  save(pattern: StopPattern): Promise<void>;
  delete(id: string): Promise<void>;
}
```

### 判断基準

```
そのメソッドはDBの状態を変えるか？
├─ YES → Repository（集約単位・エンティティを返す）
└─ NO  → Query Service（画面単位・DTOを返す）
```

### 割り当て

| 対象 | 種別 | interface 例 |
|---|---|---|
| web 駅詳細 | Query Service | `StationDetailQuery.getBySlug()` |
| web 駅検索 | Query Service | `StationSearchQuery.search()` |
| admin 駅一覧 | Query Service | `AdminStationListQuery.listByOperator()`（N+1解消を兼ねる） |
| admin 編集フォーム初期表示 | Query Service | `PlatformEditQuery.getById()` |
| admin ホーム保存 | Repository | `PlatformRepository.save()` |
| admin 停車位置パターン保存 | Repository | `StopPatternRepository.save()` |

### 用語: DTO（ViewModel ではない）

表示用に整形したデータ型は **DTO** と呼ぶ。

`ViewModel` は MVVM（WPF / Android / iOS）由来の用語で、
「Viewの状態を保持し双方向バインディングで同期するオブジェクト」を指す。
React は単方向データフロー + props であり、状態を保持する中間オブジェクトは存在しないため、
この用語は React / Next.js のエコシステムでは使われない。

`docs/spec/design.md` に既存の `PlatformViewModel` 等は **`PlatformDTO` 等へ改名する。**

### DTO の制約

DTOは **APIのレスポンス契約としてそのまま通用する形**にする。

- ✅ プリミティブ・配列・プレーンオブジェクトのみ。JSONシリアライズ可能であること
- ❌ UIフレームワーク固有の値を含めない（色コード、Tailwindのクラス名、JSX、Mantineのprops、React要素）
- ❌ メソッドを持つクラスインスタンスにしない

理由: 将来モバイル版のためにAPIを分離する際、実際に移植コストを決めるのは
**DTOの形**である（[ADR-0002](./0002-dependency-inversion-ports.md) の通り、interface の有無ではない）。
DTOが表示都合の値を含むと、API分離の時点で再設計が必要になる。

この形には既に先例がある。`apps/web/src/types/index.ts` の
`StationSearchApiResponse` / `OperatorsApiResponse` / `LineStationsApiResponse` は
Drizzle 非依存で、そのまま `/api/v1/*` のレスポンス契約として機能している。
新規のDTOは `features/*/domain/types.ts` に置くが、**性質は同じもの**とする。

なお「difficulty から表示色やラベルを決める」といった変換はDTOの責務ではなく、
順序・ラベル等の派生情報は `features/*/domain/` に明示的なマップとして置き、
最終的な見た目への変換は `features/*/components/` が行う。

---

## 各選択肢の評価

### 選択肢1: Repository で統一

- **良い点**: 抽象が1種類で済み、学習コストが低い
- **悪い点**:
  - 駅詳細ページの11テーブル横断を表現できない
  - 集約ごとの `findBy...()` 呼び出しにより N+1 が構造的に発生する
  - ページネーション・ソート・部分選択を渡そうとすると
    interface に Drizzle の概念が滲み出し、抽象化が漏れる
  - 回避しようとすると `findXxxWithYyyAndZzz()` のような特殊メソッドが増殖する
- **却下理由**: furatora は表示主体のアプリであり、読み取りが支配的。
  最も重要な経路で最も破綻する

### 選択肢2: アプリ単位で分ける

- **良い点**: どちらを使うかの判断が不要（アプリを見れば決まる）
- **悪い点**: **前提が事実と異なる。** admin は読み取りも大量に持つ
  （`stations/page.tsx` の N+1 はまさに admin の読み取りで発生している）。
  この分割では admin の読み取りが Repository に押し込まれ、選択肢1と同じ問題が起きる
- **却下理由**: 実態に反する

### 選択肢3: 操作の方向で分ける（採用）

- **良い点**:
  - 読み取り経路が集約の制約から解放され、JOIN で最小クエリにできる
  - 既存の `fetchStationDetails()` の実装をほぼそのまま `external/query/` に移せる
  - 書き込み側は集約単位を保てるため、不変条件の管理が可能
  - admin の既存 N+1 を Query Service 化のタイミングで解消できる
- **悪い点**:
  - 抽象が2種類になり、どちらを使うかの判断が必要
  - 読み取り用の型（DTO）と書き込み用の型（エンティティ）が別々に存在する

---

## 結果

### 肯定的な結果

- 駅詳細ページのクエリ数を増やさずに層を分離できる
- `apps/admin/src/app/stations/page.tsx:16-33` の N+1 を移行時に解消できる
- 画面追加時に既存 interface を汚さずに済む（新しい Query Service を1つ足すだけ）

### 否定的な結果・受け入れるトレードオフ

- **同じテーブルを引く Query Service が複数存在する。**
  例: web の駅検索と admin の駅一覧はどちらも `stations` を引くが、別の Query Service とする。
  必要なカラム・並び順・整形が異なるため、これは重複ではなく意図的な分離である。

  無理に共通化すると「どちらの画面にも過不足があるメソッド」が生まれ、
  そこから抽象化が崩れ始める。**共通化しないこと自体が決定事項である。**

- 読み取り用DTOと書き込み用エンティティで、似た形の型が二重に存在する

### 適用範囲

Issue #29 では以下に限定する。

- **Query Service**: web の `platform` / `station`
- **Repository**: admin の `stop-pattern` / `platform`

admin の一覧・編集ページの Query Service 化（N+1解消を含む）は後続Issueとする。

### 見直し条件

- Query Service の数が画面数に比例して増え続け、
  そのうち大半が単一テーブルの単純な読み取りになったとき
  （＝抽象が過剰である可能性。Query Service を薄い共通ヘルパに寄せる余地を検討する）
