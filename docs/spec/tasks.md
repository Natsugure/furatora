# タスク: ホーム図の編集で、編成の先頭・末尾を動かすと編成全体を平行移動する (Issue #201)

どのサイクルも TDD（テストを1つ書く → 期待した理由で失敗することを確かめる → 最小の実装 → 通る → Refactor）。

ブランチ: `fix/issue201-consist-shift`（`main` から）

- [x] **TASK-1** Issue #201 を起票し、ブランチを切る
- [x] **TASK-2** `docs/spec/` の3点を #201 用に書き換える
- [x] **TASK-3** サイクルA: `shiftConsistByEdge`（`editDraft.ts`）と呼び出し元の差し替え
  - `moveCarEdge` の 7 件を平行移動の期待に書き換え、関数が無い Red から実装した。`StationLayoutEditor` のハンドラが呼ぶ関数を差し替えた
  - simplify のレビューを受け、props `onMoveCarEdge` / ハンドラ `handleMoveCarEdge` を `onShiftConsist` / `handleShiftConsist` に改名した（号車の長さを変えると読めるため）
- [x] **TASK-4** サイクルB: 外端のハンドルのスナップの候補（`DiagramEditLayer.tsx`）
  - 「自分のドア（6.25m）ではなくグリッド（6.5m）に合わせる」の Red を確かめてから、候補をホーム端だけにした。「ホーム端にはスナップする」は今の候補でも通る（候補を減らしすぎないためのもの）
- [x] **TASK-5** サイクルC: インスペクタの数値入力からの結合の確認（`StationLayoutEditor.test.tsx`）
  - 修正前の実装に戻すと落ち、修正後に通ることを確かめた
- [x] **TASK-6** 検証: admin の test・型チェック・lint・build、dev サーバーで先頭・末尾をドラッグして確かめる（保存しない）
  - ユニット 695 件・型チェック・lint・`next build` が通った
  - Playwright（e2e のログイン状態、GET 以外の API は遮断。届いた数は 0）で大手町・丸ノ内線を開いた
    - 1番線（非反転）: 1号車の先頭を右へ → 6両とも +5m、各 18m のまま
    - 2番線（反転）: 1号車の先頭（end）を左へ → 6両とも -5m、続けて 6号車の末尾（start）を左へ → さらに -5m。各 18m のまま
  - 未保存の変更があるまま別の番線のタブを押すと、切り替わらずに同じ番線に留まった。この PR の前からの振る舞い（変えていない）
- [x] **TASK-7** 振り返り: `docs/domain/` の `moveCarEdge` の記述を上書きする
  - `platform-coordinate-system.md`: 関数名を直し、「号車のハンドルは2種類ある」を足した
  - `train-stop-patterns.md`: 関数名と、平行移動でも境界の共有が保たれる理由を直した
  - ADR の追加・ステータス変更は無い（ADR-0010 は編集レイヤーの置き場所の決定）
- [x] **TASK-8** PR を作る（#201 を閉じる）: #202
