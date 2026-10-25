# タスク: フリースペース・優先席のドア番号を、その号車のドア数の範囲内に限る (Issue #194)

どのサイクルも TDD（テストを1つ書く → 期待した理由で失敗することを確かめる → 最小の実装 → 通る → Refactor）。

ブランチ: `fix/issue194-near-door-range`（`main` から）

- [x] **TASK-1** ブランチを切る
- [x] **TASK-2** `docs/spec/` の3点を #194 用に書き換える
- [x] **TASK-3** サイクルA: `equipmentDoorIssues`（`features/train/domain/equipmentDoors.ts`）
  - 6 件。モジュールが無い Red から
- [x] **TASK-4** サイクルB: `trainSchema` の `superRefine`
  - 4 件のうち、範囲外の 3 件が通ってしまう Red から
  - zod 4 は中の項目に issue があっても外側の `superRefine` を走らせることを確かめた（design.md に書いた前提を直した）
- [x] **TASK-5** サイクルC: `TrainForm` の行ごとのエラー・送信の阻止・ドア番号の上限
  - 4 件の Red から。フリースペースと優先席の行を `EquipmentRows` にまとめた
  - **dev サーバーで、範囲外の値が「更新」を押したときに上限に丸まり、そのまま保存されることを見つけた**（Mantine の `clampBehavior` の既定は `blur`）。
    丸めずにエラーで止める期待にテストを書き換え（Red を確かめた）、`clampBehavior="none"` にした（REQ-7）
- [x] **TASK-6** 検証: admin の test・型チェック・lint・build、dev サーバーで確かめる
  - ユニット 687 件・型チェック・lint・`next build` が通った
  - Chrome DevTools に接続できなかったので、e2e のログイン状態で Playwright を使い、丸ノ内線の編集画面を開いた。
    1号車のフリースペースのドア番号に 9 を入れて「更新」を押すと、9 のまま、その行に「1号車のドアは1〜3番です」、通知「入力に誤りがあります。」が出て、PUT は 0 回
  - 確認の 1 回目は送信を止めておらず、丸められた 3 が development に保存された（`trains.updated_at` だけが変わり、設備の値は本番と同じ。上の不具合はこのとき見つけた）。2 回目以降は PUT を遮断して確かめた
- [x] **TASK-7** 振り返り: `docs/domain/train-stop-patterns.md` に「列車の設備（フリースペース・優先席）」を足した
  - ADR の追加・ステータス変更は無い
- [x] **TASK-8** PR を作る（#194 を閉じる）: #200
