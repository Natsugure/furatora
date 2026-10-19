# 要件: ホーム図のフリースペースの `<title>` のハイドレーション不一致を直す (Issue #143)

## 概要

- **対象**: ホーム図パッケージ（`packages/platform-diagram`）の `DiagramSvg.tsx` にある `FreeSpaceBadges`
- **参照**: [design.md](./design.md) / [tasks.md](./tasks.md) / [Issue #143](https://github.com/Natsugure/furatora/issues/143)
- **ブランチ**: `fix/issue143-free-space-title-hydration`
- **信頼度**: 95%（高）
  - 原因を React のサーバー描画のコード（`pushTitleImpl`）で確かめた（design.md「原因」）
  - 変更は1か所、文言は変えない

## 背景

Web の駅詳細（例: `/stations/tokyometro-marunouchi-awajicho`）を開くと、フリースペースの記号に付けた `<title>` で
「Hydration failed because the server rendered HTML didn't match the client.」が出る。
不一致が起きると React はツリーをクライアントで作り直すため、ホーム図の描画が二重になる。

## 要件（EARS記法）

- **REQ-1**: 駅詳細を開いたとき、システムはホーム図のハイドレーションの不一致を起こさないこと
- **REQ-2**: システムは、フリースペースの記号のツールチップに、修正前と同じ文言
  「`{号車}号車 {ドア}番ドア付近のフリースペース（全編成）`」または「…（一部編成）」を表示すること。
  サーバーが出力する HTML の `<title>` にも同じ文言が入っていること

## 受け入れ基準

| 要件 | 確かめ方 |
|---|---|
| REQ-1 | dev で駅詳細を開き、コンソールに Hydration のエラーが出ない |
| REQ-2 | フリースペースの記号にホバーし、文言が上のとおりである。ページのソース（サーバー出力）の `<title>` が空でない |

## 対象外

- 描画テストの基盤（`react-dom` の導入）を `platform-diagram` に入れること（design.md「テスト」）

## エッジケース

| ケース | 期待 |
|---|---|
| フリースペースの無い駅 | `<title>` 自体が出ないため影響なし |
| 全編成（`isStandard: true`）と一部編成が混在 | 記号ごとに（全編成）（一部編成）が正しく付く |
