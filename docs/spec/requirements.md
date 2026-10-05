# 要件: 方面ラベルの解決・接続の向きの揃え方を transfer-difficulty に集める (Issue #138)

## 概要

- **対象**: Admin と Web に重複している「駅の方面ラベルの解決」と「接続行を自駅から見た向きに揃える」規則を
  `packages/transfer-difficulty` の純関数に移し、両アプリから使う。あわせて Web の乗換セクションの組み立てを純関数に切り出す
- **参照**: [design.md](./design.md) / [tasks.md](./tasks.md) / [Issue #138](https://github.com/Natsugure/furatora/issues/138) /
  [ADR-0015](../adr/0015-shared-domain-packages-and-vocabulary.md) 決定2 / [ADR-0014](../adr/0014-direction-label-by-default-row.md)
- **ブランチ**: `refactor/issue138-shared-transfer-rules`
- **信頼度**: 90%（高）
  - 振る舞いを変えないリファクタリング。方針は ADR-0015 決定2（純粋な部分をパッケージへ、SQL は各アプリに残す）で決まっている
  - 新規 ADR は不要

## 背景

#125 で Web に乗換セクションを作ったとき、Admin の query / feature 層の規則を Web に書き写した。

1. 方面ラベルの解決: 駅の最初の路線で絞る・ホーム番号を数値順に並べる・既定行へフォールバックする
   （Admin `transferPairEditPageQuery.ts` の `hints()` と Web `transferPartnerRows.ts` の `directionLabelsOf()`）
2. 接続行の向き: 端点 A/B のどちらが自駅かを uuid の小文字比較で判定する
   （Admin `normalize.ts` の `comboOfConnection` と Web `transferPartnerRows.ts` の `orient()`）

規則を変えると2アプリを直す必要があり、Web の方面ラベル・向きの揃え方にはテストが無い
（既存の `transferPartnerRows.test.ts` は `facilitiesByRoute` だけを見る）。

### 対象外

- Issue の修正3（`isFacilityTypeCode` の共有）: #139 で `@furatora/database/enums` に移し、Web・Admin とも既に使っている

## 要件（EARS記法）

- **REQ-1**: システムは、駅の方面ラベルの解決（駅の最初の路線を引く → 駅と路線でホームを絞る → ホーム番号の数値順に並べる →
  ①ホーム ②既定行 ③フォールバックで解決する）を `@furatora/transfer-difficulty/domain` の1か所で定義すること
- **REQ-2**: システムは、駅の最初の路線の決め方（呼び出し側が `lines.displayOrder, lines.id` 順に並べた行の先頭）を同パッケージの1か所で定義すること
- **REQ-3**: システムは、接続行を自駅から見た向き（相手駅・自駅の方面・相手駅の方面）に揃える規則を同パッケージの1か所で定義すること。
  uuid は大文字小文字を区別せずに比べ、返す駅 ID は入力のままにすること。自駅に接しない行が渡された場合は、向きを決めずに例外にすること
- **REQ-3a**: 駅 ID の uuid の大文字小文字が行と食い違う場合も、システムは REQ-1・REQ-2（方面ラベル・最初の路線）を REQ-3 の組み合わせと同じ駅として解決すること
- **REQ-4**: 駅が路線を持たない場合、システムはその駅のホームや既定行があってもそれらを使わず、フォールバック（上り／下り）の表記にすること
- **REQ-5**: システムは、Admin の駅対編集画面の方面の補助表示・組み合わせと、Web の駅詳細の乗換セクションを、変更前と同じ内容で表示すること
- **REQ-6**: システムは、Web の乗換セクションの組み立て（ルートの設備・接続ごとのルート・向き・方面ラベル・相手駅へのマージ）を
  DB に依存しない純関数で行い、ユニットテストで検証できること
- **REQ-7**: `apps/` 配下に REQ-1〜3 の規則の写しが残っている場合、それは本 Issue の未完了として扱うこと
- **REQ-8**: `typecheck` / `lint` / `test` / `build` を実行したとき、システムはすべて成功すること
