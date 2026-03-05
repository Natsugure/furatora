# Test Runner Analyst Memory

## テストスタック
- ユニット/統合テスト: Vitest + React Testing Library
- E2Eテスト: Playwright
- テストコマンド: `pnpm --filter admin test`（vitestユニット）、`pnpm --filter admin test:e2e`（Playwright）

## テストファイルの場所
- ユニットテスト: テスト対象と同階層に `*.test.ts(x)` 配置
  - `/apps/admin/src/lib/validations.test.ts`
  - `/apps/admin/src/app/api/operators/route.test.ts`
  - `/apps/admin/src/app/api/operators/[operatorId]/route.test.ts`
  - `/apps/admin/src/components/DeleteButton.test.tsx`
- E2Eテスト: `/apps/admin/e2e/` 配下

## TypeScript型チェック
- `npx tsc --noEmit` をadminディレクトリで実行（ビルド不要の型チェック）
- `pnpm run build` は `pnpm --filter scripts seed` を実行するためDBが必要。型チェックのみは `tsc --noEmit` を使う

## DrizzleORMモックのパターン（重要）
- `packages/database/client.ts` の `db` は条件分岐で `PostgresJsQueryResultHKT | NeonHttpQueryResultHKT` のユニオン型を返す
- `vi.mocked(db.xxx).mockReturnValue(mock as ReturnType<...>)` は型エラーになる
  - 理由: `mockReturnValue` の引数はユニオン型の交差型を要求するため
  - `as unknown as ReturnType<...>` でも同じエラーが発生する
- **正しいパターン**: `(db.xxx as Mock).mockReturnValue(mock)` を使う
  - `import { type Mock } from 'vitest'` でMockをインポート
  - 型アサーションをモック変数側に適用し、`ReturnType<...>` を使わない

## vitest.config.ts
- `/apps/admin/vitest.config.ts`
- E2Eテストを除外: `exclude: ['**/node_modules/**', '**/e2e/**']`

## 詳細メモ
- patterns.md を参照
