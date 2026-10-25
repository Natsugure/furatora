# 要件: 乗換の評価カードのタグと補足の文言を見直す (Issue #189)

## 概要

- **対象**: Web の駅詳細の乗換の評価カード（`TransferDifficultySection`）。文言を共有する Admin のプレビュー・ルート入力
- **参照**: [design.md](./design.md) / [tasks.md](./tasks.md) / [Issue #189](https://github.com/Natsugure/furatora/issues/189) /
  [docs/domain/station-master-model.md](../domain/station-master-model.md)「Web の表示の規則」
- **進め方**: 1 つの PR（`feat/issue189-transfer-labels`）
- **信頼度**: 90%（高）。文言の差し替えと、タグ・迂回度の文の出し分けだけ

## 背景

「そのまま通れる」は何がそのままなのかが伝わらない。Web でタグが出るのはバリアフリールートだけで、必要な行為は `as_is` か `call_staff` に限られる。
ベビーカーは常に `as_is` なので、タグに情報が無い。また、本番の `requiresStaff` の3本のうち2本は `call_staff` と同じことを言っていた。

開発者と決めたこと（2026-10-25）:
- Web では `as_is` のタグを出さない（Admin のプレビューでは出す）
- 迂回度の文から、行為の括弧をやめる
- `call_staff` と `requiresStaff` は両方残し、文言と定義で切り分ける

## 要件（EARS）

- **REQ-1**: バリアフリールートの必要な行為が `as_is` のとき、システムは必要な行為をタグにしないこと
- **REQ-2**: ルートにタグが1つも無いとき、システムはタグの段を出さないこと
- **REQ-3**: 迂回度を出すとき、システムは時間の差だけを出し、必要な行為を並べないこと（同着でも）
- **REQ-4**: システムはタグと補足を、design.md の文言表のとおりに出すこと
- **REQ-5**: Admin のプレビューは、`as_is` を含めて必要な行為を出し続けること

## エッジケース

| ケース | 期待 |
|---|---|
| `as_is` でフラグも無いルート | タグの段が無い |
| `as_is` でフラグがあるルート | フラグのタグだけ |
| `as_is` と `call_staff` が混在する2本 | `call_staff` のタグだけが出て強調される（`as_is` 側はタグ無し） |
| 迂回度0 | 「通常のルートと同じ所要時間」 |
