# 設計: アプリ間で共有するロジックを packages に置く方針と、共有する語彙の置き場 (Issue #152)

方針の決定と却下した選択肢は [ADR-0015](../adr/0015-shared-domain-packages-and-vocabulary.md) に置き、ここでは実装だけを書く。

## 変更するファイル

```
docs/adr/0015-shared-domain-packages-and-vocabulary.md   新規（Proposed）
docs/adr/README.md                                        一覧に追加
packages/{transfer-difficulty,platform-diagram}/eslint.config.mjs   DB の禁止を regex にし、enums だけ許可
packages/{transfer-difficulty,platform-diagram}/package.json        dependencies に @furatora/database（workspace）
pnpm-lock.yaml                                            上記の2行ぶん（7行）
packages/transfer-difficulty/src/domain/directionLabel.ts  DirectionType を enums から import して再 export
packages/platform-diagram/src/domain/types.ts / geometry.ts / components/PlatformDiagram.tsx   'top' | 'bottom' → PlatformSide
apps/admin/src/features/transfer-connection/domain/types.ts  2つの DirectionType の一致検査を外す（DIRECTIONS の検査は残す）
packages/database/CLAUDE.md / .github/instructions/drizzle.instruction.md   enums の制約を追記
```

## ESLint の禁止パターン

```js
regex: '^(@furatora/database(?!/enums$)(/.*)?|drizzle-orm(/.*)?)$',
```

`@furatora/database` 本体と、`/enums` 以外の配下、`drizzle-orm` とその配下に一致する。

## 恒久知識の振り分け

- 方針と却下理由: ADR-0015
- `enums` の制約（入口は1つ、配下は Drizzle と実行時の依存を持たない）: `packages/database/CLAUDE.md`（変更する人が見る場所）と ADR-0015 決定3
- `enums` のディレクトリ化と `packages/database` への ESLint 導入: #139 に追記（語彙が増えるときに行う）
- `docs/domain/`: 変更なし。アーキテクチャの決定であり、ドメインルールではないため

## テスト戦略

新しいテストは追加しない。

- ESLint の発火確認: 各パッケージで、禁止対象と `enums` を import する内容を `eslint --stdin --stdin-filename src/domain/index.ts` に渡し、`enums` 以外がエラーになることを見る
- 既存の `typecheck` / `lint` / `test` / `build`
