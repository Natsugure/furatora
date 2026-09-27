# 実装タスク: line_directions に isDefault を追加する（方面ラベルの解決）(Issue #130)

- **参照**: [requirements.md](./requirements.md) / [design.md](./design.md)
- **ブランチ**: `feat/issue130-line-direction-default`（`develop` から作成）
- **前提**: #124（PR #133）が `develop` にマージ済み。駅対の編集画面の方面の補助表示は、同じ意味の行を「／」で連結する暫定実装
- **進め方**: 信頼度88%（高）のため PoC は置かず、依存の順に実装する。移行の適用（TASK-5）は開発者が行う

## フェーズ1〜2: 分析・設計

- [x] **TASK-1** 現行コードと実データの調査（`line_directions` 52行・28組、ホームの枠と `direction_type` の一致、
      `(line, direction_type, display_name)` の一意性を main で確認）。`docs/domain/`・ADR の確認。
      #124 の「フェーズ5で docs/domain/ へ移す内容」が `station-master-model.md` に反映済みであることを確認した
- [x] **TASK-2** 開発者確認（2026-09-27）: 既定を選ぶ基準は「終点方向の文言」/ 大江戸線は内回り・外回り /
      Admin での保守も本 Issue に含める
- [x] **TASK-3** `docs/spec/` 3点セットを本Issue用に全面書き換え（REQ-1〜19）。ADR-0014 を Proposed で作る

## フェーズ3: 実装 — スキーマと移行

- [x] **TASK-4** `schema.ts` に `isDefault` と `unique_line_direction_default` を追加し、`pnpm run db:generate` で 0013 を作る。
      `drizzle-kit generate --custom` で 0014 を作り、design.md「データ移行」の SQL を書く
      （依存: TASK-3。期待: 0013 が ADD COLUMN と CREATE UNIQUE INDEX だけを含む。0014 が冪等）。
      結果: 0013 は2文だけ（2026-09-27）。0014 の既存行26組の文言が main の行と完全一致することを
      Neon MCP（read-only）で照合した（26/26。残る2組は大江戸線の新規行）
- [x] **TASK-5** **【開発者】** development に 0013・0014 を適用する（`pnpm run db:migrate`。向き先が development であることを確認のうえ）。
      Claude は Neon MCP（read-only）で結果を確認する: 既定行28件、組ごとに1件以下、行数54、main には列が無い
      （依存: TASK-4）。
      結果（2026-09-27。開発者が `pnpm run db:migrate` を実行）: development で行数54・既定行28・28組すべてに既定が1行、
      2行以上の組は0。大江戸線の内回り・外回り（代表駅 都庁前）が既定。28組の文言は design.md の表と一致。
      `unique_line_direction_default` が作られている。main には `is_default` 列が無い（未適用）

## フェーズ3: 実装 — 解決規則

- [x] **TASK-6** `packages/transfer-difficulty/src/domain/directionLabel.ts` と `directionLabel.test.ts`（テストを先に書く）。
      `index.ts` から export する（依存: TASK-3。期待: `pnpm --filter @furatora/transfer-difficulty test` が通る）。
      結果: テスト先行（9件が実装なしで失敗）→ 実装。パッケージ全体で36テスト・typecheck・lint が通った

## フェーズ3: 実装 — Admin

- [x] **TASK-7** 駅対の編集画面: `transferPairEditPageQuery.ts` のホーム・既定行の読み取りと `resolveDirectionLabel`、
      `ports.ts` の `directionHints` の型、`RouteCard.tsx` の `HintText`、テストのフィクスチャ
      （依存: TASK-5・TASK-6。期待: admin のテスト・typecheck が通る）。
      結果: `RouteCard.test.tsx` に「見出しに解決済みの文言を1件ずつ出す」を追加。DB を読む部分は TASK-10 で確認する
- [x] **TASK-8** 既定行の保守: `validations.ts`（+テスト）、`features/line/ports.ts`、`lineDirectionRepository.ts`、`di.ts`、
      POST・PUT の API（+ `route.test.ts`）、`lineEditPageQuery.ts` の `currentDefaults`、`LineDirectionForm.tsx`、
      新規・編集ページ、一覧の Badge、`eslint.config.mjs` の `legacyExclusions`
      （依存: TASK-5。期待: admin のテスト・typecheck・lint が通る）。
      結果: 設計からの変更が2点。(1) 更新で既定にするとき、対象の行を先に `FOR UPDATE` で確かめる
      （別路線の id で PUT されると、404 なのに旧既定だけ外れてコミットされるため）。
      (2) フォームのテスト（`LineDirectionForm.test.tsx`・6件）を追加し、失敗時の `alert()` をフォーム内の表示に変えた
      （409 のメッセージを出すため）。POST の route は `legacyExclusions` から外した

## フェーズ4: 検証

- [x] **TASK-9** `pnpm --filter @furatora/transfer-difficulty test`、`pnpm --filter admin test`、`pnpm run build`。
      結果（2026-09-27）: transfer-difficulty 36テスト、admin 47ファイル・615テスト、admin の typecheck・lint、
      `pnpm run build`（web・admin）がすべて通った
- [x] **TASK-10** development で手動検証（開発者が `pnpm dev` を起動し、ブラウザで確認）
      - 淡路町↔小川町: 丸ノ内線側の見出しが ① のホームの文言（「東京・新宿・荻窪・方南町方面」「池袋方面」）
      - ホームが無い駅を含む駅対: ② の既定行の文言
      - 方面フォームで別の行を既定にすると元の既定が外れ、一覧の Badge が移る
      - 既定行を消すと、その組の見出しが「上り」「下り」になる（確認後、既定を戻す）

      結果（2026-09-27。Chrome DevTools MCP で操作。向き先は development）:
      - 淡路町↔小川町の見出しは、淡路町が ①「東京・新宿・荻窪・方南町方面」「池袋方面」、小川町（ホームなし）が
        ②「新宿・橋本・高尾山口方面」「本八幡方面」。開発者のスクリーンショットでも確認
      - 丸ノ内線 outbound で「東京・池袋方面」を既定にすると、フォームに「現在の既定: 池袋方面（保存すると置き換わります）」が出て、
        保存後は一覧の「既定」が「東京・池袋方面」に移り「池袋方面」から外れた。「池袋方面」を既定に戻した（逆向きの表示も確認）
      - 新宿線「本八幡方面」の既定を外すと、駅対画面の小川町 outbound が「下り」になった。既定に戻した
        （行の削除は元の id に戻せないため、既定のチェックを外す操作で ③ を確かめた）
      - 検証後の development: 行数54・既定行28・全28組が既定1件。変更したのは触った3行の `updated_at` だけ
      - 途中、駅対画面が読み込み中のまま返らない事象があった。Query を単体で実行すると0.5秒で正しい結果を返し、
        実データでの `TransferPairEditor` の描画（jsdom）も81ms で終わったため実装側ではないと判断した。
        開発サーバーを再起動したら解消した（起動中にスキーマ・共有パッケージの export を変え、移行を流したため古い状態が残ったと推定）

## フェーズ5: 振り返り

- [x] **TASK-11** `docs/domain/line-directions.md` を新規作成し、`README.md` の一覧と `station-master-model.md`「接続の端点」から参照する。
      ADR-0014 を Accepted にし、`docs/adr/README.md` の一覧を更新する（design.md「フェーズ5で恒久化する内容」）。
      結果（2026-09-27）: `line-directions.md` を新規作成（モデル・既定行の不変条件と選び方・解決規則・Admin の書き込み規約）。
      design.md の決定1（選び方の基準）・決定4〜5（大江戸線）・決定6（① の複数件）・決定7（ロックしない）は、ここと ADR-0014 に移した。
      `README.md` の一覧と `station-master-model.md`「接続の端点」「関連」から参照した。
      ほかの domain 文書（`platform-coordinate-system.md`・`station-visibility.md`・`train-stop-patterns.md`）は、
      方面を扱わないため変更なし（確認済み）。
      ADR-0014 は開発者の承認を得て Accepted にした（2026-09-27。`.claude/rules/adr.md`。実装・検証は TASK-9・TASK-10 で通過）

## フェーズ6: 引き渡し

- [x] **TASK-12** `develop` 宛ての PR の本文を用意する（エグゼクティブサマリー・変更履歴・`docs/domain`・`docs/adr` の変更点）。
      `docs/spec/` に次の Issue でも必要な内容が残っていないことを確認する。
      結果（2026-09-27）: 全体の typecheck（6）・lint（4）・test（admin 615・platform-diagram 203・transfer-difficulty 36・frontend 13）が通った。
      恒久知識の取り残しを確認した: design.md の決定1・4〜7 と解決規則・書き込み規約は `line-directions.md` と ADR-0014 に移してある。
      決定2（候補1行の組）・決定3（8組の選定）は `0014` の SQL と `line-directions.md`「既定行」に残る。
      将来作業は既存の Issue（#125 Web 表示・#128 中野坂上・#82 物理駅粒度）で追える。新しく起票する Issue は無い。
      PR: [#134](https://github.com/Natsugure/furatora/pull/134)（develop 宛て）
