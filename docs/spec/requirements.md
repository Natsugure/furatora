# 要件: admin の API GET を整理し、残る1本を Query Service 化する (Issue #48)

## 概要

- **対象**: admin の API GET のうち、db を直接読んでいる5本
- **参照**: [design.md](./design.md) / [tasks.md](./tasks.md) / [Issue #48](https://github.com/Natsugure/furatora/issues/48) /
  [ADR-0003](../adr/0003-read-write-separation.md)
- **ブランチ**: `refactor/issue48-admin-get-query-service`
- **信頼度**: 90%（高）
  - 呼び出し元は grep で確定できる。新しい抽象は作らず、既存の `TrainEditPageQuery` を広げる
  - 新規 ADR は不要（ADR-0003 の適用）

## 背景

#90（Issue #49）でフォームを props 化し、選択肢は `external/query/*EditPageQuery.ts` から読むようになった。
その結果、次の GET は呼び出し元が無くなっている。

| エンドポイント（GET） | 呼び出し元 |
|---|---|
| `api/stations/[stationId]/platform-locations` | なし（レイアウト編集画面は `stationLayoutPageQuery` で読む） |
| `api/stations/[stationId]/train-stop-patterns` | なし（同上） |
| `api/stations/[stationId]/platforms/[platformId]` | なし（`PlatformInspector` は PUT/POST だけ使う） |
| `api/trains` | なし（`app/trains/page.tsx` はページで直接読む） |
| `api/trains/[trainId]` | `components/DuplicateButton.tsx`（列車の複製） |

`GET /api/trains/[trainId]` は `carLength`（`decimal(5,2)`）を文字列のまま返す。
複製はこれを `POST /api/trains` に送るが、`trainSchema` は `carLength` を数値として検証するため、
号車の長さを入れた列車の複製は 400 で失敗する。

一覧の N+1 解消は #94 に移管済みで、本 Issue の範囲外。

## 要件（EARS記法）

- **REQ-1**: システムは、呼び出し元の無い GET（`platform-locations` / `train-stop-patterns` / `platforms/[platformId]` / `trains`）を持たないこと。同じパスの POST/PUT/DELETE は従来どおり動くこと
- **REQ-2**: `GET /api/trains/[trainId]` を受けたとき、システムは Query Service（`TrainEditPageQuery`）を通して、編集ページと同じ形の列車 DTO を返すこと（`operatorId` / `lineIds` / `carLength: number | null`）
- **REQ-3**: 指定した列車が無い場合、システムは `GET /api/trains/[trainId]` で 404 を返すこと
- **REQ-4**: 号車の長さを入れた列車を複製するとき、システムは号車構成・設備・路線を引き継いだ列車を作成すること
- **REQ-5**: システムは、`@furatora/database` を直接 import しなくなった route を ESLint の移行中の除外から外し、依存ルールを効かせること

## 範囲外

- 列車の書き込み（`trains` の POST/PUT/DELETE）の Repository 化。別 Issue に起票する
- 一覧の N+1 解消（#94）
