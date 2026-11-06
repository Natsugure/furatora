# タスク: 停車位置パターンを「1号車の外側の端＋向き」で持つ (Issue #215)

ブランチ: `refactor/stop-pattern-anchor-215`（`main` から）

- [x] **TASK-1** spec 3点セットと ADR-0025（Proposed）
- [x] **TASK-2** `packages/platform-diagram` に区間の算出（テスト先行）
  - `carSegmentsFromCarOne` / `carOneAnchorOf` / `standardCarStructure` / `resolvePatternCars`（`carSegments.ts`）。向きの語彙は `@furatora/database/enums` の `train.ts`
- [x] **TASK-3** テーブル定義と手書きマイグレーション（2列の追加と埋め込み）
  - `0022_stop_pattern_car_one_anchor.sql`（`db:generate`。2列と CHECK 制約）、`0023_backfill_stop_pattern_car_one_anchor.sql`（`--custom`。埋め込み）。そのあとテーブル定義から `trainStopPatternCars` を外した（スナップショットには残るので、2段目の `db:generate` が DROP を出す）
  - 本番（main）で埋め込みと同じ判定を SELECT で流し、算出した区間が 42 パターン・266 行のすべてで旧表と一致した（`minusX` は 20 パターン）
- [x] **TASK-4** 開発者が development に適用し、照合 SQL で旧表と全行一致することを確かめる
  - development の履歴が 0020 で止まっていた（0021 は db:push で入れた）ため、親（main）から reset して `pnpm run db:migrate` を流してもらった
  - 履歴 24 件。42 パターンすべてに基準点が入り（`minusX` 20 件）、算出した区間 266 行が旧表と全行一致した。CHECK 制約もある
- [x] **TASK-5** Web・Admin の読み取りを算出に切り替える
- [x] **TASK-6** Admin の入力スキーマ・Repository
- [x] **TASK-7** Admin の編集（`editDraft`・`DiagramEditLayer`・`StopPatternInspector`・`StationLayoutEditor`）から境界の編集をなくす
- [x] **TASK-8** 両数を減らしても1号車の位置が変わらず、消えた号車が描かれないことのテスト
- [x] **TASK-9** test / lint / typecheck、画面での確認
  - test / lint / typecheck: admin 732・web 223・platform-diagram 220 件が通った
  - Web の茗荷谷（丸ノ内線6両・`minusX`・基準点 118m）: ホーム図が描かれ、1号車が右端、6号車が 10m。コンソールのエラーは無い
  - Admin の茗荷谷1番線: ハンドルは「1号車の先頭（118m）」「6号車の末尾（10m）」の2つだけで、境界のハンドル・入力は無い。
    末尾を 12m にして保存 → PUT 200、DB の基準点が 120.00 になった。118 に戻して保存し、元に戻した
  - 初回の保存は 500 だった。development を reset する前から動いていた dev サーバーの、書き込み用の接続が残っていたため。dev サーバーを再起動したら通った
- [x] **TASK-11**（レビューで追加）インスペクタから号車ごとの区間の表示を外し、入力を先頭・末尾の2つにする
- [x] **TASK-12**（レビューで追加。改修前からの不足）編集中のパターンで号車番号の向きを反転できるようにする
  - 編成が占める区間を保って号車の並びだけを逆にする（`reverseConsist`）。1両の編成でも未保存になるよう、`isPatternDirty` は向きも比べる
  - 画面: 茗荷谷1番線で反転 → 1号車の先頭 10m・6号車の末尾 118m、ドアの印も反転。保存で DB が 10.00 / `plusX` になった。反転し直して保存し、118.00 / `minusX` に戻した
- [x] **TASK-13**（PR #225 のレビュー指摘1・4）号車構成の抜けを補い、1号車が無いパターンの保存を通知にする
  - `carStructureOrStandard` は 1..carCount を返し、未登録の号車は標準構成で補い、carCount を超える号車は除く
  - `toStopPatternPayload` は1号車が無ければ null を返し、`StationLayoutEditor` が「保存できません」を通知する（例外は async の外で捕まらなかった）
- [x] **TASK-14**（PR #225 のレビュー指摘3・8a）図のドア番号を、保存された向きで振る
  - `TrainStopPatternDTO` に `carNumbersAscendToward` を足し、`DiagramSvg` はそれで反転を決める。区間から推定する `isDoorOrderReversed`（`doorOrder.ts`）は消した
  - 1両の編成でも minusX ならドア1が右端側に来ることを `PlatformDisplay.test.tsx` で確かめた
- [x] **TASK-10** `docs/domain/` の更新、ADR-0025 を Accepted、2段目の Issue を起票
  - `train-stop-patterns.md`・`platform-coordinate-system.md` を上書きした（適用状況の注記つき）。`packages/database/CLAUDE.md` の enums の構成に `train.ts` を足した
  - ADR-0025 を Accepted にした。2段目を #224 に起票した
