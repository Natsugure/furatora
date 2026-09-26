# 実装タスク: 乗換難易度 Admin 入力フォームの対応 (Issue #124)

- **参照**: [requirements.md](./requirements.md) / [design.md](./design.md)
- **ブランチ**: `feat/issue124-transfer-difficulty-admin-form`（`develop` から作成）
- **前提**: Issue #123（PR #132）が `develop` にマージ済み。新4表には評価済み15駅対（接続60・ルート21）が
  development に入っている（本番は `main` へのリリース時に Vercel のビルドが流す）
- **進め方**: 信頼度80%（中）のため、編集画面の読み込み・保存を先に作り（TASK-5〜7）、
  **開発者が development で操作感を確認してから**（TASK-8）残りを足す

## フェーズ1〜2: 分析・設計

- [x] **TASK-1** 現行コードの調査（旧4列の読み書きの呼び出し経路、`stationConnectionRepository`、
      Admin の層構成・エラー変換・フォームの前例）と、`docs/domain/`・ADR-0011・0012 の確認
- [x] **TASK-2** 開発者確認（2026-09-26）: 重複検出は「同じ駅の範囲で提示・保存は止めない」/ 旧4列の入力 UI は #124 で撤去 /
      導出関数は新パッケージ / 本郷三丁目の備考は例外のまま残す
- [x] **TASK-3** `docs/spec/` 3点セットを本Issue用に全面書き換え（REQ-1〜28）

## フェーズ3: 実装 — 導出関数のパッケージ

- [x] **TASK-4** `packages/transfer-difficulty` を作る（`platform-diagram` の構成をまねる: package.json・tsconfig・
      vitest.config・eslint.config で DB・Next・React への依存を禁止）。`requirementFor` / `isBarrierFree` / ラベル定数と、
      7設備×2ペルソナ・混在・空集合のテスト。`apps/admin` の依存に `workspace:*` を追加する
      （依存: なし。期待: `pnpm --filter @furatora/transfer-difficulty test` が通る）。
      結果: テスト先行（実装なしで失敗を確認）→ 実装。27テスト・typecheck・lint がすべて通った（2026-09-26）

## フェーズ3: 実装 — MVP（読み込み・保存）

- [x] **TASK-5** `features/transfer-connection/domain/`（`draft.ts`・`validate.ts`）と `schema.ts`（zod）を、
      テストを先に書いて実装する。コンテキスト→下書き、下書き→入力、S/T ⇔ A/B の変換
      （`normalizeTransferEndpoints()` を再利用）、REQ-11・12 の検証と警告
      （依存: TASK-4。期待: 淡路町型・御茶ノ水型のテストデータで往復できる）。
      結果: feature 全体で63テスト・typecheck・lint が通った（2026-09-26）。`ports.ts`（DTO・ドメインエラー）と
      `domain/types.ts` もここで作った
- [x] **TASK-6** `features/transfer-connection/ports.ts`（DTO・Query・Repository・ドメインエラー）、
      `external/query/transferPairEditPageQuery.ts`、`external/repository/transferConnectionRepository.ts`
      （`savePair`。design.md「savePair の手順」）、`di.ts` への配線、
      `PUT …/transfer` の API ルートと `route.test.ts`（200・400・404・409・422）
      （依存: TASK-5。期待: 型とテストが通り、`external/` 以外が drizzle を import していない）。
      結果: 関連74テスト・typecheck・lint が通った（2026-09-26）。共通の SQL 部品は `external/transferPairSql.ts`
      （駅対の接続の条件・孤立ルートの削除。TASK-11 の `deletePair` も使う）、`pgError.ts` に制約名の取得を追加した。
      Repository・Query は DB が要るため自動テストが無く、TASK-13 の手動検証で担保する
- [x] **TASK-7** 編集画面 `app/stations/[stationId]/connections/[connectedStationId]/transfer/page.tsx` と
      `TransferPairEditor` / `RouteCard`（ルートの追加・複製・削除、設備の7種チェック、4フラグ、
      適用先 2×2、接続の備考、保存）。駅編集画面の接続カードに「乗換難易度を編集」のリンクを足す
      （依存: TASK-6。期待: development で読み込み・保存・再表示ができる）
- [x] **TASK-8** **【ゲート】** development で池袋↔西武線と淡路町↔小川町を開き、動作を確認する。
      迷う箇所（2×2 の意味、複製と割り振り）があれば、ここで画面を直してから先へ進む。
      確認結果を本欄に記録する（依存: TASK-7）。
      結果（2026-09-26。開発者が `pnpm dev` を起動し、Chrome DevTools MCP で確認。向き先は development ブランチ。
      main には新テーブルが無く、書き込み後に development の行が変わったことで確認した）:
      - 読み込み: 池袋↔西武線（2ルート）・淡路町↔小川町（丸ノ内線の方面で2枚に分かれる）・御茶ノ水（共有バッジ）が
        移行データどおりに表示された。
      - 無変更の保存（池袋↔西武・御茶ノ水 快速側・淡路町↔小川町）: ルート ID・設備・ラベル・基準ルートは不変、
        紐付けだけが入れ直された。御茶ノ水の各停側の紐付けは触られない。合計は 21ルート / 60接続 / 84紐付け / 18設備のまま。
      - ルートの追加→保存（22ルート・88紐付け・設備 `elevator`・4組み合わせ）→削除→保存で、孤立ルートが掃除され
        21/84 に戻った（孤立ルート 0・基準ルート2本以上の接続 0）。
      - 検証エラー: 名前が空・適用先が無い場合、トーストとカード内の赤い表示が出て、リクエストは送られない。
        複製すると「新規」の空カードができる。
      - 修正した点（確認で見つけた）: ① 同名の駅（池袋↔池袋）で2×2の見出しが区別できなかったので路線名を添えた /
        ② 名前順で基準ルートがルート2になっていたので、基準ルートを先頭に並べるようにした（テスト追加）。
      - 未確認: 保存後の通知（「保存しました」）は、御茶ノ水の1回で検出に失敗した（保存自体は成功）。
        重複検出・プレビューは TASK-9・10 で作る。開発者の操作感の確認は、TASK-9〜10 の後にまとめて依頼する

## フェーズ3: 実装 — 残りの機能

- [x] **TASK-9** 重複検出 `domain/duplicates.ts`（テスト先行）と `DuplicateRouteModal`、共有バッジと
      「この駅対だけ切り離す」、`mergeIntoCandidate` / `mergeCards`（REQ-15〜19。設備0件は対象外）
      （依存: TASK-8）。
      結果: `findDuplicates`（23テスト）・`applyDuplicateChoices`・`DuplicateRouteModal`（6テスト）・
      `TransferPairEditor` の結合テスト（10テスト。モーダル→共有／別ルート／キャンセル、設備0件は対象外）が通った。
      仕様の具体化: 検査対象は「新規、または設備・フラグが変わった既存ルート」（所要時分・備考だけの変更は数えない）/
      1カードにつき候補は最初の1件だけ / カードどうしは後ろのカードごとに最初に一致した前のカードとの1件だけを報告し、
      routeId を持つ側を残す / モーダルの既定は「別ルートとして作る」/ 「別ルートとして作る」を選んだ検出は
      次の保存で聞き直さない。「共有する」で付け替えた候補ルートにも共有バッジ（`usedBy`）を出す
- [x] **TASK-10** プレビュー（`packages/transfer-difficulty` で導出。設備0件は「設備が未入力」）、入力ガイド、
      警告（代替手段の同居・基準ルート無し・紐付けごとに値が異なっていた）、備考欄の説明（REQ-7・9・12・21・22・27）。
      コンポーネントのテスト（依存: TASK-8）。
      結果: `RoutePreview`（4テスト。設備0件は「設備が未入力」で導出せず・バリアフリーに数えない）・`RouteCard`（9テスト）が通った。
      入力ガイドと警告は TASK-7 の時点で `RouteCard` / `TransferPairEditor` に入っていた
- [x] **TASK-11** `stationConnectionRepository.deletePair` を `withTransaction` にし、駅対の `transfer_connections` と
      孤立ルートも削除する（REQ-25）。削除確認の文言に、評価データも消えることを足す。
      孤立ルートの削除は `savePair` と共通の内部関数にする（依存: TASK-6）。
      結果: `deletePair` を `withTransaction` にし、`transfer_connections` の削除と `deleteOrphanRoutes` を同じ
      トランザクションで行うようにした。`DeleteButton` に `description` を足し（テスト追加）、接続の削除確認に
      「乗換難易度（ルート・設備を含む評価データ）も削除する」旨を出した。Repository は DB が要るため TASK-13 の手動検証で担保

## フェーズ3: 実装 — 旧4列の撤去

- [x] **TASK-12** 旧4列を書く Admin のコードを消す（REQ-24）:
      `StationEditForm.tsx` の難易度入力と PUT ループ、`features/station/ports.ts` の `ConnectionRow` と
      `stationEditPageQuery.ts` の4列、`StationConnectionCreateForm.tsx` と `features/station-connection/schema.ts`・
      `stationConnectionRepository.createPair` の4列、`app/api/station-connections/[connectionId]/route.ts`、
      `lib/validations.ts` の `stationConnectionUpdateSchema`、`constants/difficulty.ts`、関連テスト。
      `grep` で Admin から旧4列への参照が無いことを確かめる（Web と `schema.ts` の列定義は #125 まで残す）
      （依存: TASK-8。接続の追加後は、新しい接続の乗換難易度の編集画面へ誘導する）。
      結果: 上記をすべて削除・修正した。接続の追加後は、駅対の乗換難易度の編集画面へ遷移する。
      駅編集画面の接続カードは、接続名・「乗換難易度を編集」・「接続を削除」だけにした。
      Admin の旧4列の残参照はコメントと「受け取らない」テストのみ（`grep` で確認）。
      `pnpm run typecheck`（6タスク）・`pnpm run lint`（4タスク）・`pnpm run test`（Admin 588テスト・platform-diagram 203・
      transfer-difficulty 27・frontend 13）がすべて通った（2026-09-26）

## フェーズ4: 検証

- [x] **TASK-13** 自動: `pnpm run typecheck`・`pnpm run lint`・`pnpm run test`（全パッケージ）。
      手動（development。`pnpm run dev`）: 池袋↔西武線（2ルートの読み込み・基準ルートの付け替え）/
      淡路町↔小川町（組み合わせが2本に分かれて表示・統合で孤立ルートが消える）/
      御茶ノ水（共有バッジ・切り離しで各停側は元のルートのまま）/
      池袋の別の駅対で `{elevator}` のルートを新規作成（候補モーダル→「別ルート」で作成できる）/
      未評価の駅対（三田）の新規入力 / 駅対の削除。
      Neon MCP（read-only）の SELECT で、基準ルート2本以上の接続・孤立ルート・端点の非正規化がいずれも0であることと、
      `facility_types` の7行がパッケージの `FACILITY_TYPE_CODES` と一致することを確かめる。結果を本欄に記録する
      （依存: TASK-9〜12）。
      結果（2026-09-26。Chrome DevTools MCP で操作し、Neon MCP（read-only）で検証。テスト用のデータはすべて元に戻した）:
      - 自動: `pnpm run typecheck`（6タスク）・`pnpm run lint`（4タスク）・`pnpm run test`（Admin 588・platform-diagram 203・
        transfer-difficulty 27・frontend 13）がすべて通った。
      - 重複検出（池袋↔西武線）: 新規ルート `{elevator}` を保存すると、副都心線の「エレベーター経由」との一致と、
        この画面のルート2との一致がモーダルに出た。既定は「別ルート」。「共有する」を選ぶと、新規ルートは作られず
        （21のまま）、既存ルートの紐付けが 4→8 に増えた（駅対ごとに label が違ってよい）。共有ルートのカードを削除して
        保存すると、他の駅対がまだ参照しているルートは消えず、テスト用の紐付けだけが消えた。
      - 切り離しと逆の流れ（御茶ノ水 快速側）: 「この駅対だけ切り離す」で保存すると、快速側だけ新しいルート（22本）になり、
        各停側は元のルートのままだった。カードを複製して元を消し、内容が元の共有ルートと一致する検出→「共有する」で保存すると、
        元の共有ルートに戻り、切り離しで作ったルートは孤立ルートとして削除された（21本）。
      - 接続の新規作成と削除: 「接続を追加」（池袋↔荻窪。旧4列の入力欄は無い）→ 乗換難易度の編集画面へ遷移（「未評価です」）→
        専用ルート（階段）と共有ルート（エレベーター）を保存 → 4接続（`source = manual`・端点は正規化順）→
        駅編集画面の「接続を削除」（確認文言に評価データも消える旨）で、接続一覧・`transfer_connections`・専用ルートが消え、
        共有ルートは他の駅対の紐付け4つを残した。
      - 不変条件（development 全体）: 基準ルートを2本以上持つ接続 0 / 孤立ルート 0 / ルートの無い接続 0 /
        端点の非正規化 0 / 同一接続内の label 重複 0 / `facility_types` に無い設備コード 0。
        `facility_types` の7コード（elevator, escalator, ramp, sameFloor, stairLift, stairs, wheelchairEscalator）は
        `FACILITY_TYPE_CODES` と一致。合計は 21ルート / 60接続 / 84紐付け / 18設備で、#123 の移行直後と同じ。
      - 未実施: 「未評価の駅対（三田）の新規入力」は、三田ではなく、新規に作った未評価の駅対（池袋↔荻窪）で代替した
        （どちらも接続が無く、ルート0本から入力する点は同じ。三田の実データを書き換えないため）。
        「基準ルートの付け替え」は無変更・追加・削除の保存で紐付けの入れ直しを確認したが、基準ルートの切り替え自体は
        画面で操作していない（`savePair` は全紐付けを削除してから挿入するため、順序の問題は構造的に起きない）。

## フェーズ5: 振り返り

- [x] **TASK-14** `docs/domain/station-master-model.md` の「乗換難易度」節を上書きする
      （design.md「フェーズ5で `docs/domain/` へ移す内容」）: 適用状況の注記 / 不変条件表（重複検出・孤立ルート）/
      Admin の書き込み規約 / 備考の既知の例外。`docs/domain/README.md` の一覧に変更が要るか確認する。
      結果（2026-09-26）: 上書きした。① 「乗換接続（接続一覧）」節: 旧4列は Admin から書かれず凍結、削除は評価データと
      孤立ルートも同一トランザクションで消す、作成後は駅対の編集画面へ進む ② 「乗換難易度」節の適用状況: Admin の入力まで
      実装済み・Web は #125 まで旧4列を読む（注記を外す条件は #125 の完了）③ ペルソナの導出の実装場所
      （`packages/transfer-difficulty`）④ 不変条件表: 重複検出は「提示で保存は止めない・範囲は S か T を端点に持つ接続」、
      基準ルートの付け替えは最終状態＋入れ直し、孤立ルートの掃除の実装場所 ⑤ 新設「Admin の書き込み規約」
      （駅対が編集単位・未評価の組み合わせは接続行を持たない・全方面共通は1本を4つに結ぶ・`label`/`isBaseline` は駅対の中で
      そろえる・共有ルートの編集は共有先に反映・`routeId` の範囲）⑥ 本郷三丁目の例外は「維持する」に更新。
      `docs/domain/README.md` の一覧（「乗換難易度（4層モデルと不変条件）」）は変更不要。他の domain 文書は変更なし
- [x] **TASK-15** `packages/database/src/schema.ts` の `transferRoutes`・`connectionRoutes` のコメントを、
      重複検出の範囲と孤立ルート掃除の実装場所（`transferConnectionRepository`・`deletePair`）に合わせて更新する。
      結果: 更新した（コメントのみ。スキーマ定義は不変なのでマイグレーションは無い。`packages/database` の typecheck は通った）
- [x] **TASK-16** `docs/adr/` の確認: 新規 ADR の要否を再確認する（決定2が「覆すときに明示的な意思決定を要する」に
      当たるか）。ADR-0012 は `Proposed` のまま（#125 で `Accepted`）。結果を本欄に記録する。
      結果（2026-09-26）: **新規 ADR は作らない（開発者確認済み）**。
      - 決定1・3〜6: 既存 ADR に反せず、覆すときに明示的な意思決定を要するものではない（決定3は ADR-0010 の前例に従う構成）。
      - 決定2（重複検出を「提示」に弱め、範囲を同じ駅に限る）は、却下案（ハードブロック・DB 全体・同じ駅対だけ）と根拠が
        あるため ADR の候補になりうる。ただし、恒久のルールと理由（中身が一致しても別経路でありうる）は
        `docs/domain/` の不変条件表と `schema.ts` のコメントに残しており、却下案の詳細は git 履歴の
        `docs/spec/design.md` 決定2にある。覆す条件は「誤った二重登録が実際に問題になったとき」で、
        #30 の REQ-23 は ADR ではなく spec の要件だったため、ADR の supersede は生じない。
        ADR にするかを開発者に確認し、「作らなくてよい」との回答を得た（2026-09-26）。
      - ADR-0012（`Proposed`）: #124 の側の制約は実装・検証済み（重複検出は設備0件を対象外にするテスト、プレビューは
        設備0件で導出しないテスト）。`Accepted` にする条件は #125（表示層が制約を実装すること）なので、`Proposed` のまま。
- [x] **TASK-17** 技術的負債の確認と Issue 化: `line_directions` の同義行を「／」連結で補助表示している暫定（#130 に追記）/
      旧4列・旧型・`constants/difficulty.ts`（Web 側）の削除は #125 のあとの別デプロイ（#125 に追記を提案）。
      結果（2026-09-26。開発者の承認を得て、#125・#130 にコメントを投稿した。#124 へのコメントは PR 作成後にリンク付きで投稿する）:
      - [#130] 方面ラベルの解決: 編集画面の 2×2 の見出しの補助表示は、同一 (路線, 方面) の同義行の `displayName` を
        「／」で連結している暫定（例: 丸ノ内線 inbound は5行）。`isDefault` の導入後は、既定行の1件に置き換える。
      - [#125] 旧4列（`station_connections`）は Admin から書かれず凍結されている。Web が新モデルに切り替えたあとの別デプロイで、
        4列と `StrollerDifficulty` / `WheelchairDifficulty`（`packages/database/src/enums.ts`）、Web の
        `constants/difficulty.ts` を削除する。切替前は、新モデルで入力した内容が Web に出ない期間がある（本番リリースの順序に注意）。
      - [#125] ADR-0012 の制約: 表示層は設備0件のルートで必要な行為を導出しない。`packages/transfer-difficulty` の
        `requirementFor` が `null` を返すので、`null` を「そのまま通れる」に丸めないこと。
      - E2E（Playwright）は追加していない。編集画面は単体・結合テスト（`TransferPairEditor` 等）と手動検証で担保した。
        DB を書く E2E は development を直接書き換えるため、`station-layout.spec.ts` の前例に倣うかは別 Issue で判断する。
      - 複数管理者の同時編集は後勝ち（検出しない）。管理者が増えたら、`updatedAt` による楽観的排他を検討する。
      - Repository・Query は DB が要るため自動テストが無い（CI に DB が無いのは #122・#123 と同じ）。

## フェーズ6: 引き渡し

- [x] **TASK-18** 恒久知識の取り残し確認（design.md「フェーズ5で `docs/domain/` へ移す内容」の全項目が反映済みか）。
      結果: 適用状況 / 不変条件表 / Admin の書き込み規約 / 備考の例外 / ADR（新規なし・ADR-0012 は Proposed のまま）/
      他の domain 文書（変更なし）のすべてを反映または確認済み。`docs/spec/` にのみ残る恒久知識は無い
      （決定2の却下案の詳細は design.md にあり、git 履歴に残る。ADR にしない判断は開発者確認済み）
- [ ] **TASK-19** PR 作成（開発者判断・`develop` 向け）。本文に `docs/domain/` の変更点と、
      Issue #124 本文の古い記述（直列の並び・中断する重複検出）についての読み替えを記す。
      Issue へのコメント投稿は開発者の確認後
