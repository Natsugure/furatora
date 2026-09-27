# 設計: line_directions に isDefault を追加する（方面ラベルの解決）(Issue #130)

## 参照

[requirements.md](./requirements.md) / [tasks.md](./tasks.md) /
[docs/domain/station-master-model.md](../domain/station-master-model.md)「乗換難易度」節（接続の端点）/
[ADR-0001](../adr/0001-layer-structure.md)（層と依存）/ [ADR-0002](../adr/0002-dependency-inversion-ports.md)（ports）/
[ADR-0003](../adr/0003-read-write-separation.md)（Query と Repository）/
[ADR-0005](../adr/0005-write-atomicity-driver.md)（`withTransaction`）/
[ADR-0014](../adr/0014-direction-label-by-default-row.md)（既定行で方面の文言を解決する。本Issueで作成）

既定行という仕組みを選んだ理由と、既定を選ぶ基準の根拠は ADR-0014 に書く。本書には、この作業限りの判断と、
スキーマ・移行・関数・画面の設計だけを置く。

## アーキテクチャ

```
packages/database/src/schema.ts            lineDirections.isDefault + unique_line_direction_default（部分ユニーク）
packages/database/drizzle/0013_*.sql       ADD COLUMN / CREATE UNIQUE INDEX（drizzle-kit generate）
packages/database/drizzle/0014_*.sql       既定の設定と大江戸線の2行の追加（手書きのデータ移行）

packages/transfer-difficulty/src/domain/directionLabel.ts
   resolveDirectionLabel()   … ①ホーム → ②既定行 → ③上り/下り（純粋関数。Admin と #125 の Web が使う）

apps/admin
 ├─ external/query/transferPairEditPageQuery.ts   ホームと既定行を読み、resolveDirectionLabel で見出しの文言を決める
 ├─ features/transfer-connection/components/RouteCard.tsx   HintText は1件の文字列を表示する
 ├─ features/line/ports.ts                         LineDirectionRepository / DirectionDefaultConflictError / currentDefaults
 ├─ external/repository/lineDirectionRepository.ts  create / update（既定の付け替えは withTransaction）
 ├─ external/query/lineEditPageQuery.ts            currentDefaults を埋める
 ├─ app/api/lines/[lineId]/directions/route.ts      POST → Repository
 ├─ app/api/lines/[lineId]/directions/[directionId]/route.ts   PUT → Repository（GET・DELETE は変えない）
 ├─ components/LineDirectionForm.tsx               「既定にする」チェックと現在の既定の表示
 └─ app/lines/[lineId]/directions/page.tsx          既定行に Badge
```

`resolveDirectionLabel` を `packages/transfer-difficulty` に置くのは、`requirementFor` と同じく、#125 で Web が同じ規則を使うため。
パッケージは DB に依存しないので、`DirectionType` はパッケージ内で `'inbound' | 'outbound'` として定義する
（`@furatora/database/enums` の型と構造的に互換）。

## データモデル

```ts
export const lineDirections = pgTable('line_directions', {
  // …既存列…
  // (路線, 走行方向) ごとの既定の文言。ホームが登録されていない駅で方面ラベルに使う。
  // 組ごとに高々1行（下の部分ユニーク）。0行も許容し、その場合は「上り」「下り」にフォールバックする。
  // 解決規則と選び方の基準は docs/domain/line-directions.md
  isDefault: boolean('is_default').notNull().default(false),
  // …
}, (t) => [
  uniqueIndex('unique_line_direction_default').on(t.lineId, t.directionType).where(sql`${t.isDefault}`),
]);
```

- 列の追加だけなので非破壊。1回のデプロイで入れてよい（CLAUDE.md の二段階ルールの対象外）。
- 移行 SQL（0013）は `pnpm run db:generate` で生成する。

## データ移行（0014）

`drizzle-kit generate --custom --name=set_line_direction_defaults` で空ファイルを作り、手で書く。形は 0012 にそろえる
（`DO $$ … $$`、一時テーブル、ガードを通ってから実テーブルへ書く）。

1. **大江戸線の2行を追加する**。`lines.slug = 'toei-oedo'`、代表駅は `stations.slug = 'toei-oedo-tochomae'`（決定5）。
   同じ `(line_id, direction_type, display_name)` の行が既にあれば追加しない。路線か駅が無い環境では何もしない。
2. **既定を立てる**。一時テーブル `_default (line_slug, direction_type, display_name)` に28組を入れ、
   `lines.slug` と結合して対象行を特定し、`is_default = true` にする。
   - 対象の行が無い組は飛ばす（0005 の方針）。
   - **その組に既定行が既にあれば触らない**（`NOT EXISTS`）。Admin で先に設定された値を上書きしないため、また2回目の適用で何も変えないため。
   - **組ごとに1行へ絞る**（`DISTINCT ON (line_id, direction_type)`、同名なら id の小さい行）。`(line_id, direction_type, display_name)` は
     一意制約が無く Admin から同名の行を作れるため、絞らないと同名の2行が両方 true になり、部分ユニーク違反で移行（= Vercel のビルド）が落ちる。
3. 行の特定に id を使わないのは、環境ごとに id が違いうるため（0007・0012 の前例）。
   `(line_id, direction_type, display_name)` が52行とも一意であることは main で確認済み（2026-09-27）。

### 既定にする行（決定1〜4）

| 路線（slug） | inbound | outbound |
|---|---|---|
| toei-nipporitoneri | 日暮里方面 | 見沼代親水公園方面 |
| tokyometro-marunouchi | 荻窪・方南町方面 | 池袋方面 |
| tokyometro-fukutoshin | 渋谷・東急線・みなとみらい線・相鉄線方面 | 和光市・東武線・西武線方面 |
| tokyometro-chiyoda | 代々木上原・小田急線方面 | 北綾瀬・JR常磐線方面 |
| tokyometro-hanzomon | 押上・東武線方面 | 渋谷・東急線方面 |
| tokyometro-namboku | 赤羽岩淵・埼玉高速線方面 | 目黒・東急線・相鉄線方面 |
| tokyometro-hibiya | 中目黒方面 | 北千住・東武線方面 |
| tokyometro-yurakucho | 新木場方面 | 和光市・東武線・西武線方面 |
| tokyometro-tozai | 西船橋・東葉勝田台・津田沼方面 | 中野・三鷹方面 |
| tokyometro-ginza | 渋谷方面 | 浅草方面 |
| toei-mita | 目黒・東急線・相鉄線方面 | 西高島平方面 |
| toei-oedo | **内回り**（新規） | **外回り**（新規） |
| toei-shinjuku | 新宿・橋本・高尾山口方面 | 本八幡方面 |
| toei-asakusa | 西馬込・羽田空港・三崎口方面 | 押上・印旛日本医大・成田空港方面 |

## 解決規則（`resolveDirectionLabel`）

```ts
export type DirectionType = 'inbound' | 'outbound';
export type DirectionLabelSource = 'platform' | 'default' | 'fallback';

export const FALLBACK_DIRECTION_LABELS: Record<DirectionType, string> = { inbound: '上り', outbound: '下り' };

export function resolveDirectionLabel(input: {
  directionType: DirectionType;
  /** ①: その駅のその路線のホームが、その走行方向の枠に持つ方面の文言（呼び出し側がホーム番号順に並べる） */
  platformNames: readonly string[];
  /** ②: (路線, 走行方向) の既定行の文言。無ければ null */
  defaultName: string | null;
}): { label: string; source: DirectionLabelSource };
```

- ① 重複を除いて1件以上あれば、「／」で連結して返す（REQ-10）。
- ② `defaultName` が null でなければ返す。
- ③ `FALLBACK_DIRECTION_LABELS[directionType]`。Admin の方面一覧・フォームの「上り」「下り」と同じ対応。
- `source` は、#125 で ③ のときに表示を変える（「方面未設定」と注記するなど）場合に使えるよう返す。Admin では使わない。
- 空文字の文言は、①・② ともに無いものとして扱う（`displayName` は `min(1)` の検証があるが、関数は入力を信用しない）。

## Admin: 駅対の編集画面（REQ-12）

`transferPairEditPageQuery.getContext` の `directionRows`（路線の方面をすべて取っていたクエリ）を、次の2本に置き換える。

```ts
// ①: 2駅のホームと、各枠の方面の文言
db.select({ stationId, lineId, platformNumber, inboundName: inboundDir.displayName, outboundName: outboundDir.displayName })
  .from(platforms)
  .leftJoin(inboundDir, eq(platforms.inboundDirectionId, inboundDir.id))    // alias(lineDirections, 'inbound_dir')
  .leftJoin(outboundDir, eq(platforms.outboundDirectionId, outboundDir.id))
  .where(inArray(platforms.stationId, [stationId, connectedStationId]))
  .orderBy(asc(platforms.platformNumber))

// ②: 2駅の路線の既定行
db.select({ stationId: stationLines.stationId, lineId, directionType, displayName })
  .from(lineDirections).innerJoin(stationLines, eq(stationLines.lineId, lineDirections.lineId))
  .where(and(inArray(stationLines.stationId, [...]), eq(lineDirections.isDefault, true)))
```

- 見出しの文言は、その駅の**最初の路線**（`firstLineName` と同じ行）について解決する。ホームと既定行はその路線でフィルタする。
  1駅が複数路線を持つ状態（#82 のあと）でも、別路線の文言が混ざらないようにするため。
  `firstLineNameOf` の Map を `{ lineId, lineName }` を持つ形に広げる。
- `ports.ts` の `directionHints` の型を `Record<DirectionType, string>` にする。
- `RouteCard.tsx` の `HintText` は `hint: string` を受け取って表示する（連結はしない）。③ でも「上り」「下り」を表示する
  （見出しの `inbound` / `outbound` の読み方を補うため）。

## Admin: 既定行の保守（REQ-13〜19）

### ports（`features/line/ports.ts`）

```ts
export type LineDirectionWriteInput = {
  directionType: DirectionType;
  representativeStationId: string;
  displayName: string;
  displayNameEn: string | null;
  terminalStationIds: string[] | null;
  notes: string | null;
  isDefault: boolean;
};

export interface LineDirectionRepository {
  create(lineId: string, input: LineDirectionWriteInput): Promise<LineDirectionRow>;
  /** 方面が無い、または別路線のものなら null */
  update(lineId: string, directionId: string, input: LineDirectionWriteInput): Promise<LineDirectionRow | null>;
}

/** 同じ組の既定が同時に変更された（部分ユニーク違反） */
export class DirectionDefaultConflictError extends Error { … }

// LineDirectionEditContext に追加
currentDefaults: Record<DirectionType, { id: string; displayName: string } | null>;
```

`LineDirectionRow` は API が返している行の形（`typeof lineDirections.$inferSelect` 相当）を ports 側に型として書く
（features は DB の型を import しない。ADR-0001）。

### Repository（`external/repository/lineDirectionRepository.ts`）

- `isDefault = false`: 単一表への1文なので `db` のまま書く（`lineRepository` と同じ判断。ADR-0005「単一テーブルの単純な書き込み」）。
- `isDefault = true`: `withTransaction` の中で、
  1. `UPDATE line_directions SET is_default = false WHERE line_id = $1 AND direction_type = $2 AND is_default AND id <> $self`
     （作成時は `id <> $self` を付けない）
  2. INSERT / UPDATE（`is_default = true`）
- `directionType` を変える更新も同じ手順で、**移動先の組**の既定を外す。移動元の組は既定が0行になる（REQ-3）。
- 部分ユニーク違反（`pgConstraintName(err) === 'unique_line_direction_default'`）は `DirectionDefaultConflictError` に変える。
  READ COMMITTED では、同じ組を同時に既定にする2本の書き込みの一方が違反しうる（両方が「外す」対象を読み終えてから書くため）。
  頻度は低く、ADR-0013 のようなロックは入れない（Admin は開発者1人が使う前提。0件の組は行ロックの対象も無い）。

### API

- `POST /api/lines/[lineId]/directions` と `PUT …/[directionId]` を Repository 経由にする。
  `DirectionDefaultConflictError` → 409、`update` が null → 404。
- 不正な JSON は 400（`api/lines/route.ts` と同じガード）。
- POST のファイルは `@furatora/database` を import しなくなるので、`apps/admin/eslint.config.mjs` の `legacyExclusions` から外す。
  `[directionId]/route.ts` は GET・DELETE が `db` を使うので残す。
- DELETE は変えない。既定行を消すと、その組は ③ になる（REQ-19）。どの行を昇格させるかを機械的に決められないため、自動では昇格させない。

### フォーム（`LineDirectionForm.tsx`）

- Checkbox「この路線・方面の既定の表示名にする」。説明:「ホームが登録されていない駅で、乗換案内の方面名として使われます。
  途中の駅名を含まない、終点方向の文言を選んでください」。
- `currentDefaults[directionType]` があり、それが自分でなければ「現在の既定: ○○（保存すると置き換わります）」を出す（方面タイプの切り替えにも追従）。
- 既定行を編集していて、チェックを外すか方面タイプを変えたら「保存すると、○○の既定の表示名が無くなります」を出す
  （元の組が既定行を失い ③ になるため。保存は止めない）。
- 初期値: 編集なら `initialData.isDefault`。新規なら、選択中の方面タイプに既定行が無ければ true。新規で方面タイプを切り替えたときも
  同じ規則で初期値を変える（利用者がチェックを触ったあとは変えない）。
- 409 のとき「同じ路線・方面の既定が同時に変更されました。再読み込みしてください」を表示する。それ以外の失敗は現行どおり。

## エラーマトリックス

| 状況 | 応答 |
|---|---|
| 同じ組を同時に既定にした（部分ユニーク違反） | 409 と再読み込みを促すメッセージ |
| PUT の方面が無い・別路線 | 404 |
| 本文が不正な JSON・検証失敗 | 400 |
| 移行の対象の路線・行・駅が無い環境 | その組を飛ばす |
| 移行時点で既定行がある組 | 触らない |
| ホームも既定行も無い | 「上り」「下り」 |

## テスト

- `packages/transfer-difficulty/src/domain/directionLabel.test.ts`: ①1件 / ①複数（連結・重複除去・順序保持）/ ①が空で②あり /
  ③ inbound・outbound / ①が空文字だけのときに②へ進む / ②が空文字のときに③へ進む
- `apps/admin/src/lib/validations.test.ts`: `isDefault` の省略（400。PUT で送り忘れたクライアントが既定を黙って外さないよう必須）・true・型違い
- `apps/admin/src/external/repository/lineDirectionRepository.test.ts`: クエリビルダを記録する偽物で、旧既定を外す条件
  （移動先の方面タイプ・自分自身の除外）と文の順序、対象が無いときに外さないこと、部分ユニーク違反の 409 化を確かめる
- `apps/admin/src/app/api/lines/[lineId]/directions/route.test.ts`・`[directionId]/route.test.ts`（新規。`api/lines/route.test.ts` の形）:
  201 / 400（JSON・検証）/ 409（`DirectionDefaultConflictError`）/ PUT の 404
- 既存テストのフィクスチャ（`TransferPairEditor.test.tsx`・`draft.test.ts`）を `directionHints` の新しい型に合わせる
- Query・移行 SQL は DB が要るので、development で手動検証する（tasks.md TASK-10）

## 決定記録（この作業限り）

### 決定1 — 既定を選ぶ基準は「途中の駅名を含まない、終点方向の文言」

Issue 本文の「最も一般的なもの」は採らない。根拠は ADR-0014 に書く（恒久的な基準のため）。

### 決定2 — 候補1行の組はその行を既定にする

選択の余地が無いため。

### 決定3 — 候補が複数ある8組の選定（2026-09-27 開発者と合意）

上の表のとおり。副都心線・有楽町線の outbound は「和光市・東武線・西武線方面」（小竹向原より南の駅は西武線直通がある。
小竹向原より北の駅では西武線が余計だが誤りではない）。浅草線 inbound は「西馬込・羽田空港・三崎口方面」
（泉岳寺より南の駅では羽田空港・三崎口が当てはまらないが、路線の大半の駅で通用する）。

### 決定4 — 大江戸線は「内回り」「外回り」の2行を新しく作る

既存13行は環状部の区間ごとの掲示で、どれも全駅には通用しない。開発者の指定で、inbound を内回り、outbound を外回りとする。
既存13行は消さない（ホームを登録するときに ① の文言として使う）。

### 決定5 — 大江戸線の新しい2行の代表駅は都庁前（仮置き）

`representative_station_id` が NOT NULL のため何かを入れる必要がある。環状部の起点・終点である都庁前にする。
代表駅は Admin の一覧に出るだけで、解決規則には使わない。変えるときは Admin から編集できる。

### 決定6 — ① の複数件は連結し、どちらかに決めない

中野坂上 inbound（方南町方面／荻窪・方南町方面）は #128 の既知の制約。どちらかを選ぶ規則を作ると、#128 の解決まで
誤った方面を1つだけ出すことになる。

### 決定7 — 既定行の付け替えはロックを取らず、違反を 409 にする

ADR-0013 と違い、競合時に不整合は残らない（部分ユニークが二重の既定を拒否し、トランザクションごと戻る）。
利用者は再読み込みすればよいので、ロックの仕組みを足すほどの価値は無い。

## フェーズ5で恒久化する内容

- **`docs/domain/line-directions.md`（新規）**: 同義行があること、枠と `direction_type` の関係、`is_default` の不変条件（組ごとに高々1行・0行を許容）、
  解決規則 ①→②→③ と ① の複数件の扱い、既定を選ぶ基準、大江戸線の内回り・外回り、実装の場所。
- `docs/domain/README.md`: 一覧に追加する。
- `docs/domain/station-master-model.md`「接続の端点」: 方面の文言の解決は line-directions.md を参照、と書く。
- **ADR-0014** を Accepted にし、`docs/adr/README.md` の一覧を更新する。

## 先送りする将来作業

- [#125](https://github.com/Natsugure/furatora/issues/125) Web で乗換接続の方面ラベルを表示する（`resolveDirectionLabel` を使う）
- [#128](https://github.com/Natsugure/furatora/issues/128) 中野坂上型（① が複数件になる駅）
- 大江戸線の代表駅の見直し（必要なら Admin で直す。Issue にはしない）
