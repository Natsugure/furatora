# 要件: アプリ間で共有するロジックを packages に置く方針と、共有する語彙の置き場 (Issue #152)

## 概要

- **対象**: アプリ間で共有するロジックを packages に置く方針を ADR-0015 として決める。共有する語彙を `@furatora/database/enums` に一本化し、ドメインの packages から `enums` だけを import できるようにする
- **参照**: [design.md](./design.md) / [tasks.md](./tasks.md) / [Issue #152](https://github.com/Natsugure/furatora/issues/152) /
  [ADR-0015](../adr/0015-shared-domain-packages-and-vocabulary.md) / ADR-0001 / ADR-0010
- **ブランチ**: `refactor/issue152-shared-packages-adr`
- **信頼度**: 90%（高）。方針は開発者と合意済み（語彙の置き場は「enums だけ例外で許可」）。コードの変更は型の置き換えと ESLint の設定だけ

## 背景

ADR-0015「コンテキストと課題」を参照。`FACILITY_TYPE_CODES` の移動は #139、admin と web の重複の解消は #138 で行い、本 Issue には含めない。

## 要件（EARS記法）

- **REQ-1**: システムは、共有ロジックのパッケージの単位・入れてよいもの・語彙の置き場・新設の条件・ADR-0001 との関係を ADR-0015 に記録すること
- **REQ-2**: ドメインのパッケージ（`platform-diagram` / `transfer-difficulty`）が `@furatora/database/enums` を import したとき、システムは lint を通すこと
- **REQ-3**: ドメインのパッケージが `@furatora/database`・`@furatora/database/client`・`schema`・`tx`・`drizzle-orm` を import した場合、システムは lint エラーにすること
- **REQ-4**: システムは、`DirectionType` と `PlatformSide` を `@furatora/database/enums` の1か所だけで定義すること
- **REQ-5**: システムは、`@furatora/transfer-difficulty/domain` から `DirectionType` を export し続けること（利用側の import を変えない）
- **REQ-6**: `typecheck` / `lint` / `test` / `build` を実行したとき、システムはすべて成功すること

## エッジケース

| ケース | 扱い |
|---|---|
| ESLint の `group` で `!@furatora/database/enums` を書く | 親の `@furatora/database` を除外すると再び含められず、`enums` も禁止される（実測）。`regex` で書く |
| `pnpm install` がロックファイルの無関係な peer 解決（`next` の `@babel/core`）を入れ替える | 追加した依存の7行だけをロックファイルに入れ、`pnpm install --frozen-lockfile` で整合を確認する |
