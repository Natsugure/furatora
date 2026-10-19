# タスク: ホーム図のフリースペースの `<title>` のハイドレーション不一致を直す (Issue #143)

ブランチ: `fix/issue143-free-space-title-hydration`（develop から）

- [x] **TASK-1** 原因を確かめる: React のサーバー描画の `pushTitleImpl` が、複数の子を持つ `<title>` の中身を出力しないことを確認（design.md「原因」）
- [x] **TASK-2** `docs/spec/` の3点を書き換える
- [x] **TASK-3** `DiagramSvg.tsx` の `FreeSpaceBadges` の `<title>` の子をテンプレート文字列1つにし、理由のコメントを添える
- [x] **TASK-4** 検証: `platform-diagram` の typecheck・lint・test、`pnpm run build`
  - 結果: 成功（テスト 203 件、Web・Admin のビルド成功）
- [x] **TASK-5** 検証: dev で駅詳細を開き、Hydration のエラーが出ないこと、ツールチップの文言が変わらないこと（REQ-1・REQ-2）
  - 結果: 成功（`/stations/tokyometro-marunouchi-awajicho`、Chrome DevTools）
  - 修正前: コンソールに Issue と同じ Hydration のエラー（`<title>` の `+ 1`）。サーバー出力のフリースペースの `<title>` は6つとも空
  - 修正後: コンソールのエラー・警告なし。サーバー出力とクライアントの `<title>` 6つが同じ文言
    （例: 「1号車 3番ドア付近のフリースペース（全編成）」）
- [x] **TASK-6** 振り返り: `docs/domain/` の更新要否を確認する。ADR なし
  - 結果: 変更なし。表示の実装上の不具合で、ドメインルール（ホーム図の座標系・フリースペースの意味など）は変わらない
