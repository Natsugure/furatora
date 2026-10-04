# タスク: アプリ間で共有するロジックを packages に置く方針と、共有する語彙の置き場 (Issue #152)

- [x] **TASK-1** 現状の調査。ドメインの packages が ESLint で `@furatora/database/*` を丸ごと禁止しており、`DirectionType`（transfer-difficulty）と `'top' | 'bottom'`（platform-diagram 3か所）が書き写されていることを確認した
- [x] **TASK-2** 開発者確認（2026-10-02）: 語彙の置き場は「`enums` だけ例外で許可」
- [x] **TASK-3** Issue #152 を作成し、ブランチ `refactor/issue152-shared-packages-adr` を切る
- [x] **TASK-4** `DirectionType` / `PlatformSide` を `enums` からの import に置き換える。admin の重複の一致検査を外す（依存: TASK-2）
- [x] **TASK-5** ESLint を `regex` にし、`package.json` に `@furatora/database` を足す（依存: TASK-2）
  - `group` の `!@furatora/database/enums` では `enums` も禁止されたままだった（実測）ため、`regex` にした
  - ロックファイルは、`pnpm install` が出した無関係な peer 解決の揺れを除き、追加の7行だけにした。`pnpm install --frozen-lockfile` 成功
- [x] **TASK-6** 検証（依存: TASK-4, 5）
  - ESLint の発火: 両パッケージで `@furatora/database`・`/client`・`/schema`・`drizzle-orm` がエラー、`/enums` だけ通る
  - `pnpm run typecheck`（6タスク）・`lint`（4タスク）・`test`（admin 627・platform-diagram 203・transfer-difficulty 55・frontend 42）・`build` がすべて成功
- [x] **TASK-7** ADR-0015 を書き、一覧に足す。`packages/database/CLAUDE.md` と `.github/instructions/drizzle.instruction.md` に `enums` の制約を書く
- [x] **TASK-7a** 開発者確認（2026-10-02）: 許可は import の入口 `@furatora/database/enums` に対して行い、中はディレクトリに分けてよい。個別のファイルへの import は許さない。ディレクトリ化と `packages/database` の ESLint は #139 で行う。ADR-0015 決定3 と CLAUDE.md 類を更新し、#139 に追記した
- [x] **TASK-8** ADR-0015 を `Accepted` にした（開発者承認 2026-10-02）
- [ ] **TASK-9** PR を `develop` 向けに作る
