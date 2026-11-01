# 要件: 使われていない DB の列をコードから外す（二段階の削除の1段目）

## 概要

- **対象**: `station_facilities.is_wheelchair_accessible` / `is_stroller_accessible` / `notes`、`stations.abolished_at`、`lines.abolished_at`
- **参照**: [design.md](./design.md) / [tasks.md](./tasks.md) / [Issue #217](https://github.com/Natsugure/furatora/issues/217)（2段目: DROP COLUMN）
- **進め方**: 1 つの PR（`refactor/remove-unused-columns`）。DB の列は残し、次の作業（#217）で落とす
- **信頼度**: 90%（高）。消す列はどれも、表示にも判定にも使われていないことを読み書きの経路から確かめた

## 背景

admin の駅レイアウト編集で、設備ごとに「車いす対応」「ベビーカー対応」とメモを入力させている。
しかしこの値はどこからも読まれていない。ベビーカー・車いすで通れるかは、設備の種類から導いている
（`packages/transfer-difficulty` の `REQUIREMENT_BY_FACILITY`）。
本番のデータでも、フラグはほぼ種類どおりで、食い違いは入力ミスらしいものだけだった
（2026-11-01 時点の164件のうち、`false` のエレベーター4件、`true` のエスカレーター・階段各2件）。

これを機に全テーブルの列を見直した。駅・路線の廃止日は、書き込む経路が無く、本番でも0件だった。

## 要件（EARS）

- **REQ-1** システムは、駅レイアウト編集で設備ごとの「車いす対応」「ベビーカー対応」とメモの入力欄を出さないこと。設備は種類を選ぶだけにすること
- **REQ-2** 設備の保存 API（platform-locations）が設備の種類以外の項目を受け取った場合、システムはそれを捨てて保存すること（400 にしない。古い画面からの送信を受け付けるため）
- **REQ-3** システムは、対象の5列を読み書きしないこと（テーブル定義から外し、全列 SELECT と INSERT に含まれないようにする）
- **REQ-4** システムは、Web の駅ページのホーム図を、これまでどおり描くこと
- **REQ-5** システムは、場所メモ（`platform_locations.notes`）の入力と保存を、これまでどおり行えること

## 残す列（見直した結果）

- ekidata / ODPT の ID、`source`: ADR-0007 決定3 と `docs/domain/station-master-model.md` で、出どころの記録として残すと決めている
- `stations.lat` / `lon`: 全駅にデータがあり、経路探索・地図で使える
- `trains.lines`: 開発者の判断で残す
- `createdAt` / `updatedAt`: 記録用の列
- `platform_locations.notes`: 利用者に役立つ内容なので、Web に表示する（#218）

## 対象外

- DROP COLUMN（#217）
- 場所メモの Web 表示（#218）
- 駅の新規作成でメモが保存されない不具合（#219。見直しの途中で見つかった）
