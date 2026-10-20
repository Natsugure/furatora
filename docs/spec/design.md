# 設計: ホーム座標の原点を「線路に向かって立ったときの左の端」に揃え、platformSide を廃止する (Issue #188)

原点の約束と却下案は [ADR-0022](../adr/0022-platform-origin-left-end-facing-track.md) による。ここには変更点だけを書く。

## 全体の流れ

```
一段目（この PR）
  ├─ 手書きのマイグレーション（drizzle-kit generate --custom）
  │    platform_side = 'top' のホームの座標を L − x に置き換え、platform_side を全件 null にする
  ├─ テーブル定義から platformSide を消す（列は DB に残る。読み書きしない）
  ├─ 型 PlatformSide・DTO・クエリ・リポジトリ・Admin の入力欄から除く
  └─ layoutRows() から side を除き、並びを1つに固定する
二段目（次の PR）
  └─ pnpm run db:generate → ALTER TABLE platforms DROP COLUMN platform_side
```

## マイグレーション（`packages/database/drizzle/00NN_platform_origin_left_end.sql`）

`pnpm --filter @furatora/database exec drizzle-kit generate --custom --name platform_origin_left_end` で空のファイルを作り、次を書く。
前例は `0014_set_line_direction_defaults.sql`（`DO $$ ... $$` の中で順に書き換える）。

```sql
-- ホーム座標の原点を「線路に向かって立ったときの左の端」に揃える（Issue #188 / ADR-0022）。
-- platform_side = 'top' のホームは 180° 回した向きで入っているので、座標を x' = L − x に置き換える。
-- 対象は id ではなく platform_side で選ぶ（環境ごとに id が違いうる）。最後に platform_side を全件 null にするので、
-- 2回流しても座標は戻らない。列そのものは次の作業で落とす（読むコードが無くなってから）。
DO $$
DECLARE
  v_bad text;
BEGIN
  -- ホーム長が未入力（0）なのに座標を持つ top のホームは、L が分からず変換できない。人が確かめてから流し直す
  SELECT string_agg(p.id::text, ', ') INTO v_bad
  FROM platforms p
  WHERE p.platform_side = 'top' AND p.physical_length = 0
    AND (
      EXISTS (SELECT 1 FROM train_stop_patterns t WHERE t.platform_id = p.id)
      OR EXISTS (SELECT 1 FROM platform_locations l JOIN platform_location_cells c ON c.platform_location_id = l.id
                 WHERE l.platform_id = p.id AND c.x_position_meters IS NOT NULL)
      OR EXISTS (SELECT 1 FROM platform_locations l JOIN facility_connections f ON f.platform_location_id = l.id
                 WHERE l.platform_id = p.id AND f.x_range_start IS NOT NULL AND f.x_range_end IS NOT NULL)
    );
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'ホーム長が 0 なのに座標を持つ top のホームがあります: %', v_bad;
  END IF;

  -- 号車。start と end を入れ替える（start < end を保つ）
  UPDATE train_stop_pattern_cars c
  SET start_meters = p.physical_length - c.end_meters,
      end_meters   = p.physical_length - c.start_meters
  FROM train_stop_patterns t JOIN platforms p ON p.id = t.platform_id
  WHERE c.train_stop_pattern_id = t.id AND p.platform_side = 'top' AND p.physical_length > 0;

  -- アクセス点。null（コンコース全体）は null のまま
  UPDATE platform_location_cells c
  SET x_position_meters = p.physical_length - c.x_position_meters
  FROM platform_locations l JOIN platforms p ON p.id = l.platform_id
  WHERE c.platform_location_id = l.id AND p.platform_side = 'top' AND p.physical_length > 0
    AND c.x_position_meters IS NOT NULL;

  -- 対面乗換帯。両方が非 null のときだけ帯として扱われる（DTO と同じ）
  UPDATE facility_connections f
  SET x_range_start = p.physical_length - f.x_range_end,
      x_range_end   = p.physical_length - f.x_range_start
  FROM platform_locations l JOIN platforms p ON p.id = l.platform_id
  WHERE f.platform_location_id = l.id AND p.platform_side = 'top' AND p.physical_length > 0
    AND f.x_range_start IS NOT NULL AND f.x_range_end IS NOT NULL;

  UPDATE platforms SET platform_side = NULL WHERE platform_side IS NOT NULL;
END $$;
```

- `UPDATE ... SET a = f(b), b = f(a)` は、右辺が更新前の値で評価されるので入れ替えに一時列は要らない
- `decimal(6,2)` どうしの引き算なので精度は落ちない。`L − x` が範囲（±9999.99）を超えることは無い
- `trainStopPatternCars` の一意制約は `(trainStopPatternId, carNumber)` で、座標を変えても衝突しない

### スナップショットとの食い違い

一段目ではテーブル定義から `platformSide` を消すが、DROP は生成しない（`--custom` だけを使う）。
一段目から二段目までのあいだ、テーブル定義と `drizzle/meta` のスナップショットが食い違う。二段目を次の作業にする（CLAUDE.md）。

## 図（`packages/platform-diagram`）

### `layoutRows()`（`src/domain/geometry.ts`）

```ts
// 変更前
export function layoutRows(platformSide: PlatformSide | null, options?: { hasConcourseLeaders?: boolean }): VerticalLayout;
// 変更後
export function layoutRows(options?: { hasConcourseLeaders?: boolean }): VerticalLayout;
```

- 値は今の `platformSide = 'bottom'`（と null）のときと同じにする。上から 列車行 → 隙間 → 設備行 → 束ね線
- `VerticalLayout.stripOrder` を除く。並びは `facing → diagram → plates` に固定する
- ホームの側の解釈を一手に引き受けていた理由（片方だけ反転し忘れる）は、分岐そのものが無くなるので不要になる。コメントを直す

### 描画コンポーネント

- `PlatformDiagram`: `platformSide` の prop を除く。`stripOrder` の map をやめ、3つの帯を固定の順で描く
- `ConcoursePlateRow` / `FacingTransferBannerRow`: `reverseLanes` の prop を除く（常に false だった側だけを残す）
- `PlatformDTO.platformSide` を除く（`src/domain/types.ts`）

## Web（`apps/web`）

- `external/query/stationDetailQuery.ts`: `platformSide` を select せず、DTO にも入れない
- `features/platform/components/PlatformDisplay.tsx`: `platformSide` を渡さない
- テストのフィクスチャ（`tabs.test.ts`・`getStationDetail.test.ts`）から除く

## Admin（`apps/admin`）

- `features/platform/schema.ts`・`ports.ts`・`external/repository/platformRepository.ts`: `platformSide` を除く
- `external/query/stationLayoutPageQuery.ts`: select と DTO から除く
- `features/station-layout/components/StationLayoutEditor.tsx`: `PlatformDiagram` と `PlatformInspector` へ渡さない
- `features/station-layout/components/inspector/PlatformInspector.tsx`: 「ホーム位置」の `NativeSelect` を除く。
  ホーム長の欄の `description` に「線路に向かって立ったときの左の端を 0m とします」を示す（ADR-0022）

## 共有の語彙

- `packages/database/src/enums/stationMaster.ts` の `PlatformSide` を除く（ADR-0015 の語彙。使う側が無くなる）

## エラーマトリックス

| 状況 | 応答 |
|---|---|
| ホーム長0で座標を持つ `top` のホームがある | 移行が `RAISE EXCEPTION` で失敗し、ビルドが止まる。該当ホームを Admin で確かめ、ホーム長を入れてから流し直す |
| 移行を2回流す | `platform_side` が null なので対象が無く、何も変わらない |
| 一段目のデプロイ後に古いクライアントが `platformSide` を送る（Admin の古いタブ） | スキーマから外れた項目は Zod で捨てられ、リポジトリも書かない |

## テスト方針

- `geometry.test.ts`: side ごとの `describe.each` と `stripOrder` のテストを除き、side を取らない `layoutRows()` が今の `bottom` と同じ値を返すことを確かめる（Red: 引数の型が変わるので失敗する → 実装）
- `PlatformDiagram` を使うテスト（Admin の `StationLayoutView.test.tsx`・`StationLayoutEditor.test.tsx`）: フィクスチャから除き、通ることを確かめる
- `PlatformInspector.test.tsx`: 「ホーム位置」が無く、原点の案内があることを確かめる（Red → 実装）
- `schema.test.ts`（Admin）: `platformSide` のケースを除く
- マイグレーションは単体テストを持たない（前例どおり）。development ブランチで流して、前後の値を Neon MCP で比べる

## 恒久知識の振り分け

| 内容 | 置き場 |
|---|---|
| 原点の約束と却下案 | ADR-0022 |
| 原点の約束、縦方向の並び（side の分岐が無いこと）、Admin の案内 | `docs/domain/platform-coordinate-system.md`（実装後に上書き） |
| 二段目の DROP | GitHub Issue #188（この Issue のまま、二段目の PR で閉じる） |
