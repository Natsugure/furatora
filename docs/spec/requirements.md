# 要件: packages/database の schema.ts のドメイン別分割 (Issue #149)

## 概要

- **対象**: `packages/database/src/schema.ts`（25テーブル・約400行）を、ドメイン別のファイル（`src/schema/`）に分ける。振る舞いは変えない
- **参照**: [design.md](./design.md) / [tasks.md](./tasks.md) /
  [Issue #149](https://github.com/Natsugure/furatora/issues/149)
- **ブランチ**: `refactor/issue149-split-database-schema`
- **信頼度**: 95%（高）。機械的な移動であり、DB スキーマの同一性は `db:generate` で検証できる

## 背景

モノレポのリファクタリングの1本目。1ファイルに全テーブルが並んでいて、目的のテーブルを探しにくい。
#144（`line_directions` の DROP）が入った直後で、テーブル定義と Drizzle のスナップショットが一致しているため、
分割の前後で `db:generate` が変更なしであることを検証に使える（二段階マイグレーションの途中だと DROP が混ざる）。

## 要件（EARS記法）

- **REQ-1**: システムは、テーブル定義を `packages/database/src/schema/` のドメイン別のファイルに置き、`index.ts` で全テーブル・型を再 export すること
- **REQ-2**: システムは、`@furatora/database/schema` の import パスと、そこから export される名前を変えないこと
- **REQ-3**: 分割後に `drizzle-kit generate` を実行したとき、システムはマイグレーションを生成しないこと（スナップショットと一致する）
- **REQ-4**: システムは、テーブル定義とその不変条件のコメントを、内容を変えずに移すこと（完了済みの作業を未来形で書いた記述の修正を除く）
- **REQ-5**: システムは、ファイル間の import を循環させないこと
- **REQ-6**: `typecheck` / `lint` / `test` / `build` を実行したとき、システムはすべて成功すること。`build` は DB に触れないこと
- **REQ-7**: システムは、テーブル定義のパスに言及する現在形のドキュメント（CLAUDE.md 類・`docs/domain/`）を新しいパスに直すこと。ADR は書き換えないこと（追記のみの運用）

## エッジケース

| ケース | 扱い |
|---|---|
| 分割前から `db:generate` が差分を出す | 分割の検証に使えないため、作業を止めて報告する（実測: 差分なし） |
| `import * as schema from './schema'`（client.ts / tx.ts） | `moduleResolution: Bundler` で `schema/index.ts` に解決される。変更しない |
| 元ファイルの末尾に改行が無い | 分割後のファイルは末尾に改行を付ける |
