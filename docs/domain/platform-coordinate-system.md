# ホームの座標系

> **適用状況**: 2026-08-15 現在、**未実装**。
> Issue #29（メートル座標化）で導入する仕様であり、[`docs/spec/tasks.md`](../spec/tasks.md)
> の Phase 1 以降が未着手のため、本書と `packages/database/src/schema.ts` は一致しない。
> 実装完了時（TASK-6.6）に本注記を外すこと。

ホーム上の位置は、すべて**メートル単位の1次元連続座標**で表現する。
設備・車両停車位置・乗り換え帯は、同一のホームについては同一の座標系に乗る。

## 原点

**`x = 0` はホームの物理的な一端**であり、ホームの実体は区間 `[0, physicalLength]` である。

**原点は列車のデータから導出しない。** どの停車位置パターンが登録・削除されても
原点は動かない。これが本座標系の中心的な性質であり、以下がその帰結である。

- 停車位置パターン同士は互いに独立している。あるパターンの追加・削除が
  他のパターンや設備の座標に影響しない
- 設備の座標は、列車のデータが1件も無い状態でも確定できる

### どちらの端を `x = 0` にするか

**規約で固定しない。** ホームごとに管理者が一方の端を選び、以後変えない。

現行実装にも「ホームのどちら側が起点か」を決めるデータは存在せず、
方面（`inbound` / `outbound`）はホームの左右端に紐付いていない。
したがって、どちらを選んでも表示上の情報は失われない。

- Web側は **x昇順で左→右**に描画する
- **ホーム端に方面ラベルを出さない**

将来「← 渋谷方面」を端に表示する場合は、`platforms` に「`x=0` 側がどの方面か」を
持つカラムを1つ追加すればよい。**原点が動かないため、既存座標は一切壊れない。**

## ホームの物理長

`platforms.physicalLength`（`decimal(6, 2)`、メートル）。管理者が手入力する。

ODPT から取得できないため、`update-odpt` では埋まらない。
既存行のために `default('0')` を付けて追加しており、**`'0'` は「未入力」を意味する。**
`NOT NULL` の default を外す作業は後続Issue。

## 座標の範囲

`[0, physicalLength]` の**外側にも配置できる**。負の座標も許容する。

頭端式ホームの外側にある改札、ホーム端より先に伸びる通路など、
「ホームの物理的な範囲の外だが、ホーム座標系で位置を語れるもの」を表現するため。
バリデーションで範囲を制限しない。

## 単位と精度

| 対象 | 型 | 備考 |
|---|---|---|
| `platforms.physicalLength` | `decimal(6, 2)` | |
| `trainStopPatternCars.startMeters` / `endMeters` | `decimal(6, 2)` | |
| `trainCarStructures.carLength` | `decimal(5, 2)` | nullable |
| `platformLocationCells.xPositionMeters` | `decimal(6, 2)` | nullable（null = コンコース全体） |
| `facilityConnections.xRangeStart` / `xRangeEnd` | `decimal(6, 2)` | nullable（対面乗り換え帯） |

`decimal` を使うのは浮動小数点誤差による表示崩れを避けるため。
Drizzle は `decimal` を **`string` で返す**ので、`number` への変換は
`external/query/` の中で行い、DTOより上の層に `string` を渡さない。

## 描画

SVG の `viewBox` を用い、ホーム物理長・設備位置・車両停車位置をすべて
同一のメートル座標系で描画する。

描画範囲は `physicalLength` と全設備・全停車位置パターンの座標の最小値・最大値から
マージンを加えて動的に算出する（`features/platform/domain/geometry.ts` の `computeBounds()`）。
範囲外の設備も描画対象に含める。

メートル → 画面ピクセルの換算率は **5px/m 固定**（`TrainVisualization.tsx` の
`PX_PER_METER`）。SVGの実表示サイズは「viewBox幅 × 5px」×「110px」となり、
コンテナに収まらない分は横スクロールで見る。画面幅に応じて縮小はしない
（viewBox単位で指定した文字が判読できなくなるため）。

**この横スクロールは、SVGを包む祖先の flex アイテムに `min-width: 0`
（Tailwind の `min-w-0`）が当たっていることに依存する。** flex アイテム既定の
`min-width: auto` のままだと、幅がSVGの `min-width` まで膨らんでスクロールが
成立せず、カードの `overflow-hidden` に無言で切り落とされる。

## 号車の向き

**向きを表すカラムは持たない。** 列車の向きは号車座標そのものが表現する
（1号車が x の小さい側にあるか、大きい側にあるか）。

ドア番号の反転表示は、`cars` を `carNumber` 昇順に並べたときの
`startMeters` が減少していれば反転、として導出する。

## この文書を変更するとき

**原点の定義（`x = 0` の位置）を変更する場合、保存済みの全座標の再計算が必要になる。**
`trainStopPatternCars` / `platformLocationCells` / `facilityConnections` の
すべてのメートル値が対象で、機械的な一括変換で済むとは限らない。
変更には明示的な意思決定を要する。

## 関連

- [train-stop-patterns.md](./train-stop-patterns.md) — この座標系に乗る列車の停車位置
- [ADR-0001](../adr/0001-layer-structure.md) — `geometry.ts` を `features/*/domain/` に置く理由
