# 列車の停車位置パターン

「あるホームに、ある列車が、どの位置に停まるか」を、
[ホーム座標系](./platform-coordinate-system.md)上のメートル値で表す。

## モデル

```
trainStopPatterns
  ├── platformId, trainId
  ├── unique(platformId, trainId)
  ├── carOneOuterMeters        … 1号車の外側の端（隣の号車と接していない側）のホーム座標
  └── carNumbersAscendToward   … 'plusX'（号車番号が x の増える側へ増える）| 'minusX'
```

**パターンは号車ごとの区間を持たない。** 号車の数と長さは列車の号車構成（`trainCarStructures`）で決まり、
パターンが持つのは「編成をどこに、どちら向きに置くか」だけである（[ADR-0025](../adr/0025-stop-pattern-as-car-one-anchor.md)）。

- 2列とも `NOT NULL`。パターンは必ず基準点と向きを持つ
- 向きの語彙は `@furatora/database/enums` の `CAR_NUMBERS_ASCEND_TOWARD`。DB の CHECK 制約 `train_stop_patterns_ascend_toward_known` がこの一覧に従う
- 基準点を1号車に置くので、**列車の両数・号車構成を変えても1号車の位置は変わらず、最後尾の側が伸び縮みする**。
  パターンを直す必要は無い（#215）

### 号車の区間は読むたびに算出する

`packages/platform-diagram/src/domain/carSegments.ts`（Web と Admin が共有する）。

- `carSegmentsFromCarOne()`: 1号車の外側の端から、向きの側へ `carLength` を積む。どの号車も `startMeters < endMeters` を保ち、
  各端を小数2桁に丸める
- `resolvePatternCars()`: 号車構成と基準点から、号車の区間とドア数を解決する。
  号車構成に登録の無い号車は標準構成（20m、ドア数 `DEFAULT_DOOR_COUNT` = 4）で補う
- `stopPatternCarsOf()`（`stopPatternCars.ts`）: 読み取り（Web `stationDetailQuery.ts`、Admin `stationLayoutPageQuery.ts`）の入口。
  decimal の基準点を数値にして `resolvePatternCars()` を呼び、各号車に設備（`groupEquipmentsByTrainCar()` でまとめたもの）を添える
- `carOneAnchorOf()`: 区間から基準点を戻す。Admin が平行移動した区間を保存するときに使う

画面に渡す DTO（`StopPatternCarDTO`）は区間の形のままなので、図の描画は保存の形を知らない。

**隣接号車が境界を共有すること**（重なり・隙間が無いこと）は、区間を積んで作るので構造的に成り立つ。
保存の側で検証する必要は無い。

## 標準車両長

**20.0 m**（`DEFAULT_CAR_LENGTH`）。

`trainCarStructures.carLength` が指定されていればそちらを使い、
未指定（null）の場合に標準値を用いる。号車ごとに長さの異なる編成を
表現するためのカラムであり、通常は未指定でよい。

## 列車の設備（フリースペース・優先席）

`trainEquipments` は、設備のある位置を「号車（`carNumber`）」と「その号車の何番目のドアの付近か（`nearDoor`）」で持つ。
ドアの数は `trainCarStructures.doorCount` で、号車ごとに決まる。

**設備の `carNumber` は `trainCarStructures` にある号車で、`nearDoor` はその号車の `1..doorCount` に入る。**
範囲外の値があると、ホームの図はドアを号車の外（隣の号車に入ることもある）に描き、図の下の一覧には範囲外の番号がそのまま出て、両者が食い違う。

- DB のカラム制約にはまだ現れていない（2つの表をまたぐ条件のため）
- Admin が入力側で守る。判定は `apps/admin/src/features/train/domain/equipmentDoors.ts` の `equipmentDoorIssues()` 1つで、
  API（`trainSchema` の `superRefine`）とフォーム（行ごとのエラー）が同じ関数を呼ぶ。フォームは範囲外の号車・ドア番号を上限に丸めない
  （丸めると、入力していない別の号車・ドアが保存されてしまう）
- この判定は車両構成を正として読むため、API は車両構成そのものも確かめる。号車は `1..carCount` に 1 回ずつ、`doorCount` は 1 以上
  （号車の重複は DB の一意制約 `unique_train_car_structure` でも止まる）
- 同じ種別の設備で、号車・ドア番号が同じ行は 1 つまで（DB の一意制約 `unique_train_equipment`）。
  一意制約に当たると入力の誤りが 500 になるため、`equipmentDoorIssues()` が範囲の判定と合わせて重複も拒み、2 つ目以降の行を指す。
  フリースペースと優先席が同じ号車・ドア番号にあるのは構わない
- 表示側（`packages/platform-diagram`）は範囲外の設備を落とさずに描く。データの誤りが図の上で見えるようにするため

## 停車位置の入力（Admin）

**新規作成**（`StopPatternCreateForm`）では、管理者は次の2つを入力する。

1. **編成の `x=0` に近い側の端**が、ホーム端（`x=0`）から何メートルの位置に来るか
2. **`x=0` に近い側が1号車か、最終号車か**（`carOneNearest` / `lastCarNearest`）

保存の形（1号車の外側の端＋向き）とは違うが、ホーム端からの距離で入れるほうが構内図から読み取りやすいため、
入力欄はこの形にしている。`features/stop-pattern/domain/carSegments.ts` の `buildCarSegments()` が区間に換算し
（`carOneNearest` → `plusX`、`lastCarNearest` → `minusX`、このとき1号車の外側の端は「近い側の端＋編成の全長」）、
保存の前に `carOneAnchorOf()` で基準点に戻す。

**編集**でできるのは次の2つだけ（`apps/admin/src/features/station-layout/domain/editDraft.ts`）。

- 編成全体の平行移動（図の外端のハンドルと、インスペクタの先頭・末尾の数値入力。`shiftConsistByEdge`）
- 号車番号の向きの反転（インスペクタの「号車の向きを反転」。`reverseConsist`）。**編成が占める区間は保ち**、
  号車の並びだけを逆にする。1号車は反対側の端に移り、保存では反転後の1号車の外側の端が基準点になる。
  向きを間違えて登録したパターンを、位置を合わせ直さずに直すため

**号車の長さはパターンでは変えない。** 変えるときは列車の号車構成の `carLength` を直す。

## 列車の表示判定

**あるホームにどの列車を表示するかは、停車位置パターンが登録されているかどうかのみで決まる。**
号車数とホーム長を比較した自動判定は行わない。

この帰結として、**パターンが未登録の列車はホーム表示に出てこない。**
エラーではなく正常系として扱う。データ投入時は、表示したい
(ホーム × 列車) の組み合わせすべてにパターンを登録する必要がある。

## 現在の制約: 方面別のパターンを持たない

一意キーが `(platformId, trainId)` であるため、
**同一ホーム・同一列車に対して停車位置パターンは1件しか持てない。**

この制約は、対象事業者（東京メトロ・東京都交通局）に上下共用のホームが
存在しないことに依存している。2026-08-15 時点で `inbound_direction_id` と
`outbound_direction_id` の両方が設定された `platforms` レコードは0件。

| ケース | 成立するか |
|---|---|
| 片方向のホーム | ✅ 1件で足りる |
| 折返しホーム（終端駅・支線） | ✅ 進行方向は反転するが**編成は物理的に反転しない**ため停車位置は1通り |
| **上下共用の中線**（JRの国鉄型2面3線等） | ❌ 逆向きの停車で号車座標が2通り必要になるが登録できない |

3つ目が破綻すると、片方の方面で号車番号が左右反転し、
「2号車付近のエレベーター」が実際には7号車付近を指す**誤案内**になる。

### `platforms` を番線ごとに分ける回避策は使えない

設備は `platformId` にぶら下がっている。

```
platformLocations.platformId → platforms.id
  ├── platformLocationCells → stationFacilities
  └── facilityConnections
```

同一の物理ホームを2レコードに分けると、設備・コンコース・乗り換え接続が
**二重登録**になり、コンコース単位グルーピングが同じ階段を別物として扱い始める。
この回避策は検討済みであり、成立しない。

### 対応が必要になったときの移行手順

**トリガー**: 上下共用の中線を持つ事業者（JR東日本等）を追加するとき。
**この作業は当該Issueの見積もりに必ず含めること。**

1. `trainStopPatterns` に `directionId`（nullable、`→ lineDirections.id`）を追加する。
   セマンティクスは **`null` = このホームの全方面に共通**
2. 一意キーを `(platformId, trainId, directionId)` に変更し、
   **`.nullsNotDistinct()` を付ける**。PostgreSQL の `UNIQUE` は既定で NULL 同士を
   重複とみなさないため、これが無いと「方面なし」のパターンを何件でも登録できてしまう
   （drizzle-orm 0.45.1 に実装あり。Neon は PG15+ で利用可）
3. 読み取り側に「タブの方面に一致するパターン → 無ければ `null` のパターン」という
   フォールバック解決を追加する
4. Admin の入力欄は既定「全方面共通」とし、必要なホームでのみ方面を選ばせる

**既存レコードは `directionId = null` のまま意味が通るため、データ変換・再入力は発生しない。**

### Issue #29 で対応しなかった理由

JR追加時点で必要なキーが本当に「方面」なのかが未確定なため。
中線は方面ではなく運用（待避・折返し）で停車位置が分かれる可能性があり、
また号車数が10両/15両で大きく変わるため `trains` の粒度自体の見直しが入りうる。
実データが1件も無い状態で解決ロジックを設計すると作り直しになる
（[ADR-0002](../adr/0002-dependency-inversion-ports.md) の「推測で設計しない」と同じ判断）。

## 関連

- [platform-coordinate-system.md](./platform-coordinate-system.md) — 座標の原点・単位・描画範囲
- [ADR-0025](../adr/0025-stop-pattern-as-car-one-anchor.md) — 号車ごとの区間ではなく、1号車の外側の端＋向きで持つ理由
