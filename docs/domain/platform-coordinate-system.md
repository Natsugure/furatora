# ホームの座標系

> **適用状況**: 2026-08-21 現在、**実装済み・検証未完了**。
> スキーマ（`packages/database/src/schema.ts`）・Admin・Web描画はいずれも本書に一致する。
> ただし [`docs/spec/tasks.md`](../spec/tasks.md) の Phase 6（検証）が未実施のため、
> 本注記は残す。TASK-6.6 完了時に外すこと。

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

### 横方向

描画範囲は `physicalLength` と全設備・全停車位置パターンの座標から
マージンを加えて動的に算出する（`features/platform/domain/geometry.ts` の `computeBounds()`）。
範囲外の設備も描画対象に含める。

メートル → 画面ピクセルの換算率は **5px/m 固定**（`TrainVisualization.tsx` の
`PX_PER_METER`）。SVGの実表示幅は「viewBox幅 × 5px」となり、
コンテナに収まらない分は横スクロールで見る。画面幅に応じて縮小はしない
（viewBox単位で指定した文字が判読できなくなるため）。

**この横スクロールは、SVGを包む祖先の flex アイテムに `min-width: 0`
（Tailwind の `min-w-0`）が当たっていることに依存する。** flex アイテム既定の
`min-width: auto` のままだと、幅がSVGの `min-width` まで膨らんでスクロールが
成立せず、カードの `overflow-hidden` に無言で切り落とされる。

### 縦方向

**縦方向は実寸ではない。** 横方向と単位（メートル）は共通だが、値は
「コンコースラベル段 / 設備行 / 隙間 / 列車行」を積んだ図式的な高さである。

列車行を基準に、**ホーム上にあるものはすべて列車行のホーム側**（`platforms.platformSide`）
に配置する。ホーム帯・対面乗り換え帯・設備行・コンコース束ね線とラベルがこれに当たる。

**side 依存の座標は `geometry.ts` の `layoutRows()` が一手に決める。** 個別の描画箇所で
side を解釈すると片方だけ反転し忘れ、要素が列車を挟んで散らばったり viewBox 外へ出たりする。
`layoutRows()` は各段の上端を返し、呼び出し側は side によらず**常に下向きに**積めばよい。

SVGの高さは固定ではなく `layoutRows().viewHeight` で決まる。コンコースラベルが
1件も無いホームでは 22（実表示 110px）で、ラベルの段数ぶんだけ伸びる。

### コンコースの表現

コンコース（`platformLocations`）は座標を持たない。**その位置は、属するアクセス点
（`platformLocationCells.xPositionMeters`）の範囲として表す。**

同一コンコースのアクセス点は**束ね線（ブラケット）**で結び、その先に
出口名（`exits`）と乗り換え先（`facilityConnections`）のラベルを置く。
これが「同一コンコース単位のグルーピング」の図的表現であり、
「どの階段・エレベーターがどの出口・どの乗り換えに通じるか」を図だけで読めるようにする。

- 座標を持つアクセス点が1つも無いコンコースは図に描けない。
  出口名・乗り換え先ともに、SVG外のテキストリストに委ねる
- 乗り換え先の路線名は**接続先駅に乗り入れる全路線**であり、大規模駅では図に収まらない。
  図のラベルは短縮し（`domain/concourse.ts` の `connectionShortLabels()`）、
  全文は `<title>` とテキストリストに残す
- ラベルどうしが横方向に重なる場合は段を分けて積む
  （`domain/concourseLayout.ts` の `layoutConcourseLabels()`）。
  SVGの高さはその段数に応じて伸びる

**図とテキストリストは役割が違う。図は位置関係の把握、リストは全文の網羅である。**
図のラベルは省略されうるので、リストを削ると省略された情報の参照先が
`<title>` のホバーだけになり、タッチ環境で失われる。

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
