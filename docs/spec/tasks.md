# タスク: 駅から乗り換えられる路線を導くドメインの関数を作る (Issue #172)

ブランチ: `feat/issue172-reachable-lines`（`main` から）

どのサイクルも TDD（テストを1つ書く → 期待した理由で失敗することを確かめる → 最小の実装 → 通る → Refactor）。

- [x] **TASK-1** ブランチを切る。#96 の「背景」に、乗換単位の役割と #96 の前提を書き足す
- [x] **TASK-2** ADR-0021 を `Proposed` で書き、`docs/adr/README.md` の一覧に足す。`docs/spec/` の3点を書き換える
- [x] **TASK-3** サイクルA: `reachableLines`（`reachableLines.test.ts`）
  1. 自駅の路線だけを `here` に返す（春日）
  2. 同じ駅名の乗換先は `here` の後ろ（渋谷）
  3. 別の駅名の乗換先は `transfers` に駅名ごと、最初に出た順（淡路町）
  4. 同じ路線名は1つ（同じ駅の2行／段をまたぐ重複）
  5. 路線色が null の路線も残す
  6. 何も無ければ両方とも空
  - 1〜4 は Red（モジュール無し／期待値との不一致）を確かめてから実装した
  - 5 は 2〜4 のフィクスチャ（色 null）が既に検証しているため、テストを足さなかった
  - 6 は境界の仕様として足し、**最初から通った**（実装の自然な帰結）
- [x] **TASK-4** サイクルB: `StationLines`（`StationLines.test.tsx`）
  1. `here` の路線名が `aria-label="路線"` のリストに出る
  2. `transfers` があれば「乗り換え」の見出しの下に駅名と路線
  3. `transfers` が空なら「乗り換え」を出さない
  4. 両方とも空なら何も描画しない
  5. （追加）自駅の路線が無く乗換先だけのとき、空の「路線」のリストを出さない
  - 1・2・4・5 は Red を確かめてから実装した。3 は 2 の実装に条件分岐を含めたため**最初から通った**
- [x] **TASK-5** サイクルC: DTO とクエリ
  - `getStationDetail.test.ts` のフィクスチャに `stationLines` を足し、型エラーを確かめてから `StationDetailDTO` に足す
  - `stationDetailQuery.ts` で自駅の全路線を取り、`stationLines` と `headerLineColor` を作る（単体テストの例外。design.md）
- [x] **TASK-6** `page.tsx` を `reachableLines` + `StationLines` に置き換え、`stationLineChips.ts` とそのテストを消す
- [x] **TASK-7** 検証: web の test / lint / 型チェック / build。dev サーバーで春日・淡路町・渋谷をスマホ幅と PC 幅で確かめる
  - test 23ファイル・155件成功、lint・`tsc --noEmit`・`next build` 成功
  - 淡路町（390px）: 見出し直下は丸ノ内線のみ。「乗り換え」に 新御茶ノ水=千代田線、小川町=都営新宿線
  - 春日（ホームなし、390px）: 都営三田線・都営大江戸線（同じ駅名の乗換先）。「乗り換え」に 後楽園=丸ノ内線
  - 渋谷（銀座線、1280px）: 11路線が見出し直下に折り返して並ぶ。DB の乗換先10路線＋自駅1路線と一致
    （Issue の「13個」は起票時点の数。欠落ではない）
- [x] **TASK-8** 振り返り: `docs/domain/station-master-model.md` を上書きで更新する。#166 の暫定を指すコメントを直す。
  ADR-0021 を `Accepted` にする（開発者の承認を得てから）
  - [x] `station-master-model.md`: 「コード体系」に乗換単位を乗換の判定に使わない理由と役割、「乗換接続」に Web の見出しの路線の導き方を書いた
  - [x] 暫定を指すコメントは `stationLineChips.ts` と page.tsx にあり、どちらも置き換えで消えた
  - [x] 開発者の承認を得て ADR-0021 を Accepted にした
- [ ] **TASK-9** 引き渡し: PR（`main` 向け）。#172 を閉じ、#96 との関係を本文に書く
- [ ] （開発者）御茶ノ水まわりの誤った乗換接続4組を Admin で削除する
