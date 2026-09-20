# 実装タスク: web のフォント変数クラス位置を修正する (Issue #107)

- **対象**: `apps/web`、`packages/platform-diagram`
- **参照**: [requirements.md](./requirements.md) / [design.md](./design.md)
- **作成日**: 2026-09-18
- **ブランチ**: `fix/issue107-font-variable-class-on-html`

## フェーズ3: 実装

- [x] **TASK-1** `apps/web/src/app/layout.tsx`: `notoSansJP.variable` /
      `bizUdpGothic.variable` を `<body>` から `<html>` へ移動。`font-sans antialiased
      flex flex-col min-h-screen` は `<body>` に残した。フォント定義の直前に
      admin と揃えた理由コメントを追加
- [x] **TASK-2** `apps/web/src/app/globals.css`: `--font-sign`（`var(--font-biz-udpgothic)`
      / `var(--font-noto-sans-jp)`）と `@theme inline` の `--font-sans`
      （`var(--font-noto-sans-jp)`）に第2引数（汎用フォント名フォールバック）を追加。
      `<html>` に付けることを既存コメントに追記
- [x] **TASK-3** `packages/platform-diagram/src/styles.css`: `--font-sign` に同様の
      フォールバックを追加し、`<html>` に付けることをコメントに追記
- [x] **TASK-4** `packages/platform-diagram/README.md`: 「公開面」節に
      「`next/font` の変数クラスは `<html>` に付けること」を利用側の必須手順として追記。
      web はこの `styles.css` を import していない旨（`--font-sign` は web 側の
      `globals.css` で自前定義）も追記

## フェーズ4: 検証

- [x] `pnpm run typecheck` → 全パッケージでエラー0（5 successful）
- [x] `pnpm run lint` → 全パッケージでエラー0（3 successful）
- [x] `pnpm run test`（リポジトリ全体）→ platform-diagram 182件 / web 13件 /
      admin 465件、すべて pass（既存テストへの回帰なし）
- [x] `pnpm run build`（リポジトリ全体）→ web・admin ともに成功。生成CSSを確認:
      ```
      --font-sans:var(--font-noto-sans-jp,"Noto Sans JP"),system-ui,sans-serif
      --font-sign:var(--font-biz-udpgothic,"BIZ UDPGothic"),"BIZ UDPGothic",...
      ```
      フォールバック引数を含めて意図どおり出力されていることを確認
- [x] **ブラウザでの手動確認**（issue 記載の確認方法 + `document.fonts.check`）:
      `pnpm --filter @furatora/frontend dev` を起動し、Chrome DevTools MCP で
      `/stations/tokyometro-ginza-shibuya`（銀座線渋谷。1番線に実データあり）を確認
      - `document.documentElement.className` に両フォント変数クラスが付与されていることを確認
      - 号車番号（1〜6号車、`fontFamily: var(--font-sign)` を持つ `<text>` 要素）の
        `getComputedStyle().fontFamily` が全件 `"BIZ UDPGothic"` から始まることを確認
        （修正前は継承により無効値・ブラウザ既定フォントだった）
      - `document.body` の `getComputedStyle().fontFamily` が `"Noto Sans JP"` から
        始まることを確認
      - `document.fonts.check('400 16px "BIZ UDPGothic"')` /
        `document.fonts.check('400 16px "Noto Sans JP"')` がともに `true`
        （next/font の webfont が実際にロードされていることを確認）
      - トップページ・駅詳細ページをフルページスクリーンショットで確認し、
        レイアウト崩れが無いことを目視確認
      - 確認後、dev server は停止した
- [x] **回帰の観点**: 本文フォントがブラウザ既定フォント → Noto Sans JP に変わる
      （修正前は `body { font-family: var(--font-sans) }` の `var()` が無効値になり
      `unset` 継承でブラウザ既定フォントに落ちていたため、Mantine の既定フォント指定
      すら効いていなかった。design.md「原因」参照）。意図した変化であり、
      スクリーンショット確認でレイアウト崩れは無かった

## フェーズ5: 振り返り

- [x] `docs/domain/` の確認: 書体の適用先はドメインルールではなく、
      `platform-coordinate-system.md` 等の既存ファイルにも該当記述が無い。
      **変更なし**（確認した上での判断）
- [x] `docs/adr/` の確認: 新規決定・ステータス変更なし。既存 ADR（ADR-0006 / ADR-0010）
      に反する設計をしていないため対象外
- [x] issue 本文の修正方針3（`--font-sign` の二重定義統合）について: 調査の結果
      `apps/web` は `packages/platform-diagram/styles.css` を import しておらず
      import 順の衝突が実際には発生していないことを確認し、開発者に提示した。
      統合はスコープ外とし、両ファイルのコメント整備のみで対応する方針に確定した
      （requirements.md「対象外」/ design.md 参照）

## フェーズ6: 引き渡し

- [x] 変更ファイル: `apps/web/src/app/layout.tsx` /
      `apps/web/src/app/globals.css` / `packages/platform-diagram/src/styles.css` /
      `packages/platform-diagram/README.md` / `docs/spec/requirements.md` /
      `docs/spec/design.md` / `docs/spec/tasks.md`（本ファイル）
- [x] 恒久知識の取り残し確認: 本件はバグ修正であり、`docs/domain/` /
      `docs/adr/` に昇格すべき恒久知識は発生しなかった（フェーズ5で確認済み）
- [ ] PR作成・レビュー依頼（開発者判断）
