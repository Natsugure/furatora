# 要件: ホーム座標の原点を「線路に向かって立ったときの左の端」に揃え、platformSide を廃止する (Issue #188)

## 概要

- **対象**: ホーム座標の原点の約束、`platforms.platformSide`、ホーム図（`packages/platform-diagram`）の上下の並び、Admin のホームの編集欄
- **参照**: [design.md](./design.md) / [tasks.md](./tasks.md) / [Issue #188](https://github.com/Natsugure/furatora/issues/188) /
  [ADR-0022](../adr/0022-platform-origin-left-end-facing-track.md) / [Issue #174](https://github.com/Natsugure/furatora/issues/174)（この作業を前提にする）
- **ブランチ**: `feat/issue188-platform-origin`（`main` から）
- **信頼度**: 88%（高）
  - 書き換える座標は2ホーム分（池袋2番線・茗荷谷1番線）。`top` の残り6ホームはホーム長0・座標なし
  - `platformSide` を読む箇所は限られる（web のクエリ・DTO、Admin のクエリ・リポジトリ・入力欄、図の `layoutRows()`）
  - 不確かな点: 手書きのマイグレーションを流したあとの2ホームの見え方（Admin と Web の両方で目で確かめる）

## 背景

#174 で、ホーム図を「線路に向かって立った見え方」で描くことにした（図は回してよいが、鏡写しにしない）。
今は「どちらの端を `x = 0` にするか」を規約で固定しておらず、向きは `x = 0` の端と `platformSide` の組で決まっている。
`platformSide` が `top` の8ホームだけが180°回した向きで入っているので、データの側で揃えて、約束を1つにする（ADR-0022）。

## 要件（EARS記法）

### 一段目（この PR）

- **REQ-1**: システムは、ホーム座標の原点を「線路に向かって立ったときの左の端」とすること（ADR-0022）
- **REQ-2**: 移行のとき、`platformSide = 'top'` かつホーム長が0より大きいホームについて、システムはそのホームのすべての座標を `x' = physicalLength − x` に置き換えること
  - 号車（`trainStopPatternCars`）: `startMeters' = L − endMeters`、`endMeters' = L − startMeters`
  - アクセス点（`platformLocationCells.xPositionMeters`）: null は null のまま
  - 対面乗換帯（`facilityConnections`）: `xRangeStart' = L − xRangeEnd`、`xRangeEnd' = L − xRangeStart`（両方が非 null のときだけ）
- **REQ-3**: `platformSide = 'top'` でホーム長が0なのに座標を持つホームがある場合、システムは移行を失敗させること（正しく変換できないため。人が確かめてから流し直す）
- **REQ-4**: 移行のあと、システムはすべてのホームの `platformSide` を null にすること（移行を2回流しても座標が戻らないようにするため）
- **REQ-5**: システムはホーム図を、ホームの側によらず「列車の下にホーム・設備・束ね線・出口と乗換のプレート、上に対面乗換のバナー」の並びで描くこと（今の `bottom` の並び）。Web と Admin の両方
- **REQ-6**: システムは `platformSide` を読まず、書かないこと（テーブル定義・DTO・クエリ・リポジトリ・入力のスキーマ・型 `PlatformSide` から除く）
- **REQ-7**: Admin のホームの編集欄から「ホーム位置」の選択を除き、代わりに原点の約束（線路に向かって左の端を 0m にする）を示すこと

### 二段目（次の PR。この PR のデプロイのすぐ次の作業）

- **REQ-8**: 一段目のデプロイのあと、システムは `platforms.platform_side` の列を落とすこと（`pnpm run db:generate` で DROP を作る）

### ドキュメント

- **REQ-9**: `docs/domain/platform-coordinate-system.md` を、原点の約束と side による分岐の除去を反映した姿に上書きすること

## 受け入れ基準

| 要件 | 確かめ方 |
|---|---|
| REQ-1 | ADR-0022 がある。domain 文書の「どちらの端を x = 0 にするか」が約束を書いている |
| REQ-2・REQ-4 | development ブランチで移行を流し、Neon MCP（読み取り）で池袋2番線・茗荷谷1番線の座標が `L − x`（start/end 入れ替え）になり、`platform_side` が全件 null になったことを確かめる。流す前の値を控えておく |
| REQ-3 | 移行の SQL に、該当するホームがあれば `RAISE EXCEPTION` する分岐がある（今のデータには該当なし。SQL を読んで確かめる） |
| REQ-5 | `layoutRows()` の単体テスト（side を取らない、並びが1つ）。Admin と Web で、池袋2番線が回る前と180°回った見え方になったことを目で確かめる |
| REQ-6 | `git grep -E "platformSide\|PlatformSide"` がマイグレーションと文書以外に出ない。型チェック・テストが通る |
| REQ-7 | `PlatformInspector` の単体テスト（「ホーム位置」が無く、約束の案内がある） |
| REQ-8 | 二段目の PR で `ALTER TABLE ... DROP COLUMN platform_side` が生成され、ほかの変更が混ざっていない |
| REQ-9 | domain 文書のレビュー |

## 範囲外

- #174 の内容（縦の図、新しい見た目、対面乗換の置き場の変更、折りたたみ）。この作業では並びを今の `bottom` に固定するだけ
- ホーム端の方面ラベル（「← 渋谷方面」）。必要になれば「`x = 0` 側がどの方面か」を持つ列を足す（domain 文書）
- 外部の資料から座標を入れ直すこと

## 依存関係とリスク

| 依存・リスク | 影響 | 緩和 |
|---|---|---|
| 移行は Vercel のビルドで各環境に流れる（ADR-0008） | Preview でも本番のコピーに対して流れる | 環境ごとに id が違いうるので、id ではなく `platform_side = 'top'` で対象を選ぶ。2回流しても変わらない（REQ-4） |
| 一段目から二段目の間、テーブル定義と Drizzle のスナップショットが食い違う | 他の作業で `db:generate` / `db:push` を実行すると DROP が混ざる | 二段目を次の作業にする（CLAUDE.md） |
| デプロイ前に管理者が Admin で `top` のホームを新しく作る | そのホームも移行の対象になる | 移行は「流れた時点の `top`」を対象にするので正しく変換される |
| 移行の書き換えを誤る | 2ホームの図が鏡写しになる | 流す前の値を控え、流した後に比べる。Admin と Web で目で確かめる |

## エッジケース

| ケース | 期待 |
|---|---|
| `top`・ホーム長 > 0・座標あり（池袋2・茗荷谷1） | 座標を `L − x` にし、start/end を入れ替える |
| `top`・ホーム長 0・座標なし（6件） | `platformSide` を null にするだけ |
| `top`・ホーム長 0・座標あり | 移行を失敗させる（REQ-3） |
| アクセス点の `xPositionMeters` が null（コンコース全体） | null のまま |
| 対面乗換帯の片方だけが null | 触らない（今の DTO でも帯として扱われない） |
| ホームの範囲外の座標（負の値、`L` より大きい値） | 同じ式で変換する（180°回すだけなので範囲外も保たれる） |
| `bottom`・未設定のホーム | 座標は変えない |
