# 要件: 列車（trains）の書き込みを Repository にする (Issue #163)

## 概要

- **対象**: Admin の列車 API（`POST /api/trains`・`PUT /api/trains/[trainId]`・`DELETE /api/trains/[trainId]`）
- **参照**: [design.md](./design.md) / [tasks.md](./tasks.md) / [Issue #163](https://github.com/Natsugure/furatora/issues/163) /
  [ADR-0003](../adr/0003-read-write-separation.md) / [ADR-0005](../adr/0005-write-atomicity-driver.md)
- **進め方**: 1 つの PR（`refactor/admin-train-repository-163`）
- **信頼度**: 90%（高）。`stopPatternRepository` と同じ形で書ける。画面の動きは変わらない

## 背景

列車の書き込みは route が `db` を直接使っており、ADR-0003（書き込みは Repository）に沿っていない。
POST / PUT は `trains`・`train_car_structures`・`train_equipments` に分けて書くが、トランザクションで囲んでいない。
とくに PUT は号車構成・設備を消してから入れ直すので、入れ直しに失敗すると消えたままになる。
2 つの route は `apps/admin/eslint.config.mjs` の `legacyExclusions` に入っている。

## 要件（EARS）

- **REQ-1** 列車を作るとき、システムは列車・号車構成・設備を 1 つのトランザクションで書くこと
- **REQ-2** 列車を更新するとき、システムは列車の更新と号車構成・設備の入れ直しを 1 つのトランザクションで行うこと
- **REQ-3** 作成・更新の途中で書き込みが失敗した場合、システムはそれまでの書き込みを残さず、500 を返すこと
- **REQ-4** 更新・削除の対象の列車が無い場合、システムは 404 を返し、号車構成・設備に触れないこと
- **REQ-5** 列車を作ったとき、システムは作った列車の `id` を 201 で返すこと
- **REQ-6** システムは、列車の route から `@furatora/database` と `drizzle-orm` を import しないこと（ESLint の依存ルールを除外なしで通す）
- **REQ-7** 入力の検証（`trainSchema`）、パスパラメータの検証、PUT・DELETE の応答（`{ success: true }`）は、REQ-8 を除いていまと同じにすること
- **REQ-8** 同じ種別の設備（フリースペース・優先席）に同じ号車・ドア番号の行が 2 つ以上ある場合、システムは API では 400 と2つ目以降の行を指すエラーを返し、フォームではその行にエラーを出して送信しないこと（PR #213 のレビューで追加。これまでは一意制約 `unique_train_equipment` に当たって 500 だった）

## 対象外

- `carLength` の `String()` / `Number()` の変換をなくすこと（#165）
- 列車一覧ページ（`app/trains/page.tsx`）の Query Service 化と、`legacyExclusions` に残るほかのファイル（後で Issue を立てる）
