# 要件: ホーム図の設備アイコンに wheelchairEscalator を足す (Issue #140)

## 概要

- **対象**: ホーム図（`packages/platform-diagram` の `DiagramSvg`）の設備アイコンの対応表 `FACILITY_ICON_FILES` に
  `wheelchairEscalator` を足し、今後の登録漏れをコンパイルエラーにする。Admin の `public/icons/` に画像を置く
- **参照**: [design.md](./design.md) / [tasks.md](./tasks.md) / [Issue #140](https://github.com/Natsugure/furatora/issues/140) /
  [ADR-0016](../adr/0016-facility-type-codes-constant-as-source.md) / [ADR-0015](../adr/0015-shared-domain-packages-and-vocabulary.md) 決定3
- **ブランチ**: `fix/issue140-wheelchair-escalator-icon`
- **信頼度**: 95%（高）
  - 変更は対応表の型と1行、画像1枚。前提の #139（`FacilityTypeCode` を `@furatora/database/enums` へ）は完了済み
  - 新規 ADR は不要（ADR-0016 の方針の適用）

## 背景

`wheelchairEscalator`（#122 / マイグレーション 0010）を足したとき、対応表を更新していなかった。
対応表の型が `Record<string, string>` のため、登録漏れがコンパイルエラーにならない。
画像は Web にはあるが Admin に無い。該当する `station_facilities` の行は 0 件で、実害は無い。

## 要件（EARS記法）

- **REQ-1**: アクセス点の設備が `wheelchairEscalator` のとき、システムはホーム図に `wheelchair_escalator.png` のアイコンを描画すること（Web・Admin とも）
- **REQ-2**: `FACILITY_TYPE_CODES` に対応表のキーが無い設備の種類がある場合、システムは typecheck でエラーにすること
- **REQ-3**: 稼働中のコードが知らない設備の種類が DB から来た場合、システムは従来どおり代替の記号（📍）で描画し、エラーにしないこと
- **REQ-4**: システムは、設備の種類を足す手順（`packages/database/src/enums/facility.ts` のコメント）と `platform-diagram` の README に、アイコンの追加を含めること
