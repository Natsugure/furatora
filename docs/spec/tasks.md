# 実装タスク: 乗換難易度 Web 表示の対応 (Issue #125)

- **参照**: [requirements.md](./requirements.md) / [design.md](./design.md)
- **ブランチ**: `feat/issue125-transfer-difficulty-web`（`develop` から作成）
- **前提**: #122・#123・#124・#130 が `develop` にマージ済み
- **進め方**: 信頼度80%（中）のため、MVP（TASK-4〜7）を作り、**開発者が development で見た目を確認してから**（TASK-8）仕上げる

## フェーズ1〜2: 分析・設計

- [x] **TASK-1** 現行コード（`TransferDifficultySection`・`stationDetailQuery`）・パッケージ・domain・ADR-0011〜0014 の確認と、
      development の実データの確認（評価済み7駅対・ルート21本・設備0件6本・方面差は淡路町↔小川町だけ）
- [x] **TASK-2** 開発者確認（2026-09-27〜28）: ペルソナ2列を維持 / 未評価の相手駅も一覧に出す /
      「確認できていない」状態を足す / `isOfficiallyGuided = false` は確認済みの値なので表示する
- [x] **TASK-3** `docs/spec/` の3点セットを本 Issue 用に全面的に書き換える

## フェーズ3: 実装 — MVP

- [x] **TASK-4** `packages/transfer-difficulty/src/domain/assessment.ts` をテスト先行で実装する（依存: なし。
      期待: `pnpm --filter @furatora/transfer-difficulty test` が通る）。
      結果: テスト先行（18件の失敗を確認）→ 実装。`lightestRequirement` は重さの順序を外に出さないため `requirement.ts` に置いた。
      54テスト・typecheck・lint が通った（2026-09-28）
- [x] **TASK-5** Web の DTO と `transferView.ts`（`groupCombos`・`differingFields`）をテスト先行で実装する。
      `apps/web/package.json` に依存を足す（依存: TASK-4）。結果: 12テストが通った
- [x] **TASK-6** `transferPartnerRows.ts` と `stationDetailQuery.ts` の変更。旧4列の読み取りを外す（依存: TASK-5）。
      確認中に追加: 相手駅の駅名を DTO に足した（ekidata のグループに別駅が入る。例: 淡路町 → 御茶ノ水の丸ノ内線・JR）
- [x] **TASK-7** `TransferDifficultySection.tsx` の書き換えとコンポーネントテスト。`constants/transferDifficulty.ts` を足し、
      `constants/difficulty.ts` を削除する（依存: TASK-5・6）。確認中に追加: 評価済みの相手駅を先に並べる／
      相手駅の駅名が自駅と違えば選択肢に「（駅名）」を添える。Web は 36 テスト・typecheck・lint が通った。
      淡路町・小川町・春日・池袋を Chrome DevTools で表示できることを確認した
- [x] **TASK-8** 開発者が development で確認する（淡路町・小川町・池袋・後楽園・淡路町↔新御茶ノ水）。
      指摘（2026-09-28）: 設備未入力のルートの有無・件数・名前を Web に出さない。Admin で一覧する Issue を起票（#135）

## フェーズ3: 実装 — 仕上げ

- [x] **TASK-9** TASK-8 の指摘を反映する。「未入力のルートが N 本あります」の注記と「確認できていません」の補足（ルート名）を削除し、
      最も軽い行為の前置きを「確認できているルートでは、」にした。パッケージの `notEnteredCount` / `notEntered` を削除。
      値が異なる項目の強調・迂回度は実データに該当が無いため、自動テストで確認した

## フェーズ4: 検証

- [x] **TASK-10** `test` / `typecheck` / `lint`（パッケージと web）と `pnpm run build`。結果: パッケージ 54・web 37・admin 626 テスト、
      typecheck・lint、build（web・admin）がすべて通った
- [x] **TASK-11** Chrome DevTools で手動確認する（requirements の REQ-11〜17）。淡路町・小川町・春日・池袋で確認。
      駅詳細のコンソールにハイドレーションエラーがあるが、ホーム図（`FreeSpaceBadges` の `<title>`）で発生しており本 Issue の変更外

## フェーズ5: 振り返り

- [x] **TASK-12** `docs/domain/station-master-model.md`「乗換難易度」の適用状況の注記を外し、表示の規則を書く
- [x] **TASK-13** `docs/domain/line-directions.md` の適用状況の最後の2文を外す
- [x] **TASK-14** ADR-0012 を `Accepted` にする（決定の表示の記述を、未入力を利用者に出さない形に直してから）

## フェーズ6: 引き渡し

- [x] **TASK-15** 旧4列・enum の削除 Issue を起票する（#136）
- [x] **TASK-16** PR を作る（#124 と同じリリースで出すことを明記する）。PR #137
