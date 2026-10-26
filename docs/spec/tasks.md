# タスク: 列車（trains）の書き込みを Repository にする (Issue #163)

どのサイクルも TDD（テストを書く → 失敗を確かめる → 実装 → 通る）。

ブランチ: `refactor/admin-train-repository-163`（`main` から）

- [x] **TASK-1** `docs/spec/` の3点を #163 用に書き換える
- [x] **TASK-2** `TrainRepository` を `features/train/ports.ts` に定義する
- [x] **TASK-3** `trainRepository.test.ts` を書いて落ちることを確かめ、`dbTrainRepository` を実装して通す
- [x] **TASK-4** route のテストを Repository のモックに書き換えて落ちることを確かめ、`di.ts` と route を Repository 経由にして通す
- [x] **TASK-5** `legacyExclusions` から trains の2件を外す
- [x] **TASK-6** 検証: admin の lint・typecheck・test、e2e（列車の作成・編集・複製・削除）
  - lint・typecheck が通り、vitest は 56 ファイル・724 件が通った（Repository 8 件、route 15 件を追加・書き換え）
  - 列車の書き込みを通しで試す e2e は無いため、一時的な Playwright テストを development DB で流して消した（コミットしない）
    - 作成（201・`{ id }`）→ 読み取り → 更新 → 404 の分岐 → 削除。どれも期待どおりだった
    - ロールバック: 設備を重複させて最後の insert を一意制約違反にすると、500 を返し、列車名・号車構成・設備は更新前のまま残った
  - 複製（`DuplicateButton`）は GET → POST の組み合わせ。どちらも上で確かめたので、画面からは試していない
- [x] **TASK-7** 振り返り: `docs/domain/` の変更が要らないことを確かめる。ADR-0005 のステータスを確かめる
  - `docs/domain/` には列車の書き込みの記述が無く、層の構成もドメインのルールも変わらないため、更新しない
  - ADR-0003・ADR-0005 を `Accepted` にした（開発者の判断）。ADR-0005 の前提だった `USE_LOCAL_DB` の廃止はすでに済んでいる
