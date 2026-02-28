# 実装タスク: Admin UI刷新 (Mantine v8導入)

## 概要

- **対象**: `apps/admin`
- **参照**: [`requirements.md`](./requirements.md) / [`design.md`](./design.md)
- **作成日**: 2026-02-26
- **ブランチ**: `claude/admin-update-plan-nCBCo`

---

## フェーズ構成

```
Phase 1: Mantine セットアップ               (基盤)
Phase 2: レイアウト・共通コンポーネント移行  (P0)
Phase 3: フォームコンポーネント移行          (P0)
Phase 4: 一覧・詳細ページのUI移行           (P0)
Phase 5: ローディング状態の実装             (P1)
Phase 6: 日本語UI統一                       (P1)
Phase 7: 新規ページ作成                     (P1)
Phase 8: レスポンシブデザイン               (P2)
Phase 9: Gemini AI連携                      (P3)
```

---

## Phase 1: Mantine セットアップ

### TASK-1.1: パッケージインストール
- **説明**: `apps/admin` に `@mantine/core` と `@mantine/hooks` をインストールする
- **コマンド**: `pnpm add @mantine/core @mantine/hooks` (apps/adminディレクトリで実行)
- **期待結果**: `apps/admin/package.json` の `dependencies` に追加される
- **依存**: なし

### TASK-1.2: MantineProvider設定
- **説明**: `apps/admin/src/app/layout.tsx` にMantineProviderを設定する
- **実装内容**:
  - `@mantine/core/styles.css` をインポート
  - `ColorSchemeScript` を `<head>` に追加
  - `MantineProvider` でコンテンツをラップ
  - デフォルトカラースキーム: `'light'`
- **期待結果**: 全ページでMantineコンポーネントが正常に動作する
- **依存**: TASK-1.1

### TASK-1.3: PostCSS設定確認・調整
- **説明**: TailwindCSS v4とMantineのCSS設定が競合しないか確認し、必要に応じて調整する
- **確認対象**: `apps/admin/postcss.config.js` または `postcss.config.mjs`
- **期待結果**: ビルドエラーなし
- **依存**: TASK-1.2

---

## Phase 2: レイアウト・共通コンポーネント移行

### TASK-2.1: Sidebar.tsx → AppShell移行
- **説明**: カスタムCSSのサイドバーをMantine `AppShell` + `AppShell.Navbar` + `NavLink` に移行
- **対象ファイル**: `src/components/Sidebar.tsx`, `src/app/layout.tsx`
- **実装内容**:
  - `AppShell` をレイアウトに設定 (`navbar={{ width: 220, breakpoint: 'sm' }}`)
  - ナビゲーションリンクを `NavLink` に置き換え
  - モバイル用ハンバーガーボタンを `Burger` で実装
  - opened状態を `useDisclosure` で管理
- **期待結果**: デスクトップでサイドバー表示、スマートフォンでハンバーガーメニュー表示
- **依存**: TASK-1.2, TASK-1.3

### TASK-2.2: DeleteButton.tsx → Modal移行
- **説明**: 現在の `confirm()` ダイアログをMantine `Modal` による確認UIに移行
- **対象ファイル**: `src/components/DeleteButton.tsx`
- **実装内容**:
  - `useDisclosure` でモーダル開閉状態を管理
  - 削除確認モーダルに日本語テキスト
  - 削除実行中は `Button loading={true}` を表示
- **期待結果**: ブラウザデフォルトのダイアログが不要になる
- **依存**: TASK-1.2

### TASK-2.3: DuplicateButton.tsx / FacilityDuplicateButton.tsx 移行
- **説明**: 複製ボタンをMantine `Button` に移行
- **対象ファイル**: `src/components/DuplicateButton.tsx`, `src/components/FacilityDuplicateButton.tsx`
- **依存**: TASK-1.2

---

## Phase 3: フォームコンポーネント移行

### TASK-3.1: LineForm.tsx 移行
- **説明**: シンプルなフォーム（入力フィールド1〜2個）のMantine移行
- **対象ファイル**: `src/components/LineForm.tsx`
- **移行内容**:
  - `<input type="text">` → `<TextInput>`
  - `<button>` → `<Button>`
  - submit中のloading状態追加
- **依存**: TASK-1.2

### TASK-3.2: LineDirectionForm.tsx 移行
- **説明**: 方向フォームのMantine移行
- **対象ファイル**: `src/components/LineDirectionForm.tsx`
- **依存**: TASK-1.2

### TASK-3.3: TrainForm.tsx 移行
- **説明**: 列車フォームのMantine移行（Select, TextInput等）
- **対象ファイル**: `src/components/TrainForm.tsx`
- **依存**: TASK-1.2

### TASK-3.4: StationNotesForm.tsx 移行
- **説明**: 駅メモフォームのMantine移行
- **対象ファイル**: `src/components/StationNotesForm.tsx`
- **依存**: TASK-1.2

### TASK-3.5: ConnectionsEditSection.tsx 移行
- **説明**: 接続編集セクションのMantine移行（Select, ActionIcon等）
- **対象ファイル**: `src/components/ConnectionsEditSection.tsx`
- **依存**: TASK-1.2

### TASK-3.6: StationEditForm.tsx 移行
- **説明**: 駅編集フォーム（260行）のMantine移行
- **対象ファイル**: `src/components/StationEditForm.tsx`
- **移行内容**:
  - `<textarea>` → `<Textarea>`
  - `<select>` → `<Select>`
  - フォームバリデーションエラー表示を `error` propに
- **依存**: TASK-3.5

### TASK-3.7: PlatformForm.tsx 移行
- **説明**: ホームフォーム（356行）のMantine移行（最複雑）
- **対象ファイル**: `src/components/PlatformForm.tsx`
- **移行内容**:
  - `<input type="number">` → `<NumberInput>`
  - 連鎖する `<select>` → `<Select>` (onChange連動)
  - 動的配列行 → `<ActionIcon>` (追加/削除ボタン)
  - ローディング中のスピナー表示
- **依存**: TASK-1.2

### TASK-3.8: FacilityForm.tsx 移行
- **説明**: 設備フォーム（328行）のMantine移行（最複雑）
- **対象ファイル**: `src/components/FacilityForm.tsx`
- **移行内容**:
  - `<select>` → `<Select>` (platformId選択)
  - `<input type="number">` → `<NumberInput>` (nearPlatformCell)
  - `<input type="text">` → `<TextInput>` (exits, notes)
  - 設備タイプのチェックボックス群 → `<Checkbox>` + `<Collapse>`/`<Card>`
  - 接続駅の動的リスト → `<Select>` + `<ActionIcon>`
  - ローディング状態 (3つのfetch) → 個別`<Loader>`
- **依存**: TASK-1.2

---

## Phase 4: 一覧・詳細ページのUI移行

### TASK-4.1: ダッシュボード (/) 移行
- **説明**: 統計カードをMantine `Card`/`SimpleGrid` に移行
- **対象ファイル**: `src/app/page.tsx`
- **依存**: TASK-2.1

### TASK-4.2: 路線一覧 (/lines) 移行
- **説明**: テーブルをMantine `Table` に移行
- **対象ファイル**: `src/app/lines/page.tsx`
- **依存**: TASK-2.1

### TASK-4.3: 駅一覧 (/stations) 移行
- **説明**: 階層表示をMantine `Table`/`Accordion` に移行
- **対象ファイル**: `src/app/stations/page.tsx`
- **依存**: TASK-2.1

### TASK-4.4: 列車一覧 (/trains) 移行
- **説明**: テーブルをMantine `Table` に移行
- **対象ファイル**: `src/app/trains/page.tsx`
- **依存**: TASK-2.1

### TASK-4.5: 未解決接続 (/unresolved-connections) 移行
- **説明**: リストをMantine `Table`/`Stack` に移行
- **対象ファイル**: `src/app/unresolved-connections/page.tsx`
- **依存**: TASK-2.1

### TASK-4.6: その他の詳細・編集ページ移行
- **説明**: 各詳細ページのラッパーUI（タイトル・パンくず・アクションボタン）をMantine移行
- **対象ファイル**: 各 `page.tsx` (directions, platforms, facilities等)
- **依存**: TASK-2.1

---

## Phase 5: ローディング状態の実装

### TASK-5.1: loading.tsx ファイルの追加
- **説明**: 主要ページにNext.jsの `loading.tsx` をMantine `Skeleton` で実装
- **対象ディレクトリ**: `/stations`, `/lines`, `/trains`, `/unresolved-connections`
- **実装内容**: 各ページのレイアウトに合わせたSkeletonを配置
- **依存**: TASK-1.2

### TASK-5.2: フォーム内ドロップダウンのローディングスピナー
- **説明**: useEffect内でAPIデータ取得中に `<Loader size="sm">` を表示
- **対象**: PlatformForm.tsx, FacilityForm.tsx, TrainForm.tsx 等
- **依存**: TASK-3.7, TASK-3.8

### TASK-5.3: フォーム送信中の待機表示
- **説明**: 全フォームの送信ボタンに `loading` prop を実装（Phase 3で並行実施）
- **依存**: Phase 3 全体

---

## Phase 6: 日本語UI統一

### TASK-6.1: 英語テキストを日本語に置換
- **説明**: 全コンポーネント・ページ内の英語ラベル・ボタン・プレースホルダーを日本語に統一
- **置換対象**:
  - ボタン: "Create" → "登録", "Update" → "更新", "Cancel" → "キャンセル", "Delete" → "削除", "Edit" → "編集"
  - フォームラベル: "Platform" → "ホーム", "Wheelchair accessible" → "車いす対応", "Stroller accessible" → "ベビーカー対応" 等
  - エラーメッセージ: "Failed to save" → "保存に失敗しました" 等
  - ページタイトル・ナビゲーション: "Lines" → "路線", "Stations" → "駅", "Trains" → "列車", "Operators" → "事業者", "Unresolved Connections" → "未解決接続" 等
  - Confirm: "Are you sure you want to delete?" → "本当に削除しますか？"
- **依存**: Phase 2, Phase 3, Phase 4

---

## Phase 7: 新規ページ作成

### TASK-7.1: Operators APIルート確認・拡張
- **説明**: `/api/operators` のルートハンドラーが CRUD をサポートしているか確認し、不足分を実装
- **対象**: `src/app/api/operators/`
- **依存**: なし

### TASK-7.2: OperatorForm.tsx 作成
- **説明**: オペレーター作成・編集用フォームコンポーネントを新規作成
- **フィールド**: ODPTコード、事業者名、よみがな等（DBスキーマに合わせて）
- **対象**: `src/components/OperatorForm.tsx`
- **依存**: TASK-1.2, TASK-7.1

### TASK-7.3: Operators ページ作成
- **説明**: `/operators`, `/operators/new`, `/operators/[operatorId]/edit` ページを作成
- **依存**: TASK-7.2

### TASK-7.4: Lines APIルート拡張
- **説明**: 路線の基本情報（ODPTコード・名称・オペレーター等）を編集できるようAPIを拡張
- **対象**: `src/app/api/lines/`
- **依存**: なし（DBスキーマ確認後に実装）

### TASK-7.5: LineForm.tsx 拡張
- **説明**: 既存のLineForm.tsxを拡張し、よみがな以外の基本情報フィールドを追加
- **依存**: TASK-3.1, TASK-7.4

### TASK-7.6: Stations基本情報 APIルート拡張
- **説明**: 駅の基本情報（名称・ODPTコード・オペレーター等）を編集できるようAPIを拡張
- **対象**: `src/app/api/stations/`
- **依存**: なし

### TASK-7.7: StationEditForm.tsx 拡張
- **説明**: 既存のStationEditForm.tsxを拡張し、よみがな以外の全フィールドを編集可能にする
- **依存**: TASK-3.6, TASK-7.6

### TASK-7.8: Sidebaarにナビゲーション追加
- **説明**: Sidebarに「事業者」ナビゲーションリンクを追加し、既存の「路線」「駅」リンクを更新
- **依存**: TASK-2.1, TASK-7.3

---

## Phase 8: レスポンシブデザイン

### TASK-8.1: AppShellのモバイル対応確認
- **説明**: TASK-2.1で実装したAppShellのモバイル表示を確認・調整
- **確認項目**:
  - 375px (iPhone SE) での表示
  - ハンバーガーメニューの動作
  - ナビゲーションの開閉
- **依存**: TASK-2.1

### TASK-8.2: フォームのモバイル対応
- **説明**: 各フォームコンポーネントでMantineのレスポンシブgrid/stackが適用されているか確認
- **確認項目**: 水平レイアウトが必要な箇所でモバイル時に縦積みになるか
- **依存**: Phase 3

### TASK-8.3: テーブルのモバイル対応
- **説明**: 一覧テーブルが横スクロールまたはカード形式でモバイル表示されるか確認・調整
- **依存**: Phase 4

---

## Phase 9: Gemini AI連携 (P3 - 将来対応)

### TASK-9.1: 環境変数設定
- **説明**: `GEMINI_API_KEY` を `.env.local` テンプレートおよびドキュメントに追記
- **依存**: なし

### TASK-9.2: Gemini Server Action実装
- **説明**: Server ActionでGemini APIを呼び出し、ODPT IDから日本語名・路線コードを推測する
- **対象**: `src/actions.ts` または新規 `src/actions/gemini.ts`
- **使用モデル**: Gemini 無料枠 (例: `gemini-1.5-flash`)
- **依存**: TASK-9.1

### TASK-9.3: 未解決接続ページへのAI提案UI追加
- **説明**: 未解決接続の各行に「AI提案」ボタンを追加し、提案をフォームに自動入力する
- **対象**: `src/app/unresolved-connections/page.tsx`
- **依存**: TASK-9.2, TASK-4.5

---

## タスクサマリー

| フェーズ | タスク数 | 優先度 | 推定規模 |
|---------|---------|-------|---------|
| Phase 1: Mantineセットアップ | 3 | P0 | S |
| Phase 2: レイアウト・共通移行 | 3 | P0 | M |
| Phase 3: フォーム移行 | 8 | P0 | L |
| Phase 4: ページUI移行 | 6 | P0 | M |
| Phase 5: ローディング状態 | 3 | P1 | S |
| Phase 6: 日本語UI統一 | 1 | P1 | M |
| Phase 7: 新規ページ | 8 | P1 | L |
| Phase 8: レスポンシブ | 3 | P2 | S |
| Phase 9: Gemini AI | 3 | P3 | M |
| **合計** | **38** | | |

---

## 実装順序の依存関係

```
TASK-1.1 → TASK-1.2 → TASK-1.3
                 │
                 ├── TASK-2.1 (レイアウト) → TASK-4.x (ページUI)
                 │                         → TASK-8.1
                 ├── TASK-2.2 (DeleteButton)
                 ├── TASK-3.1〜3.8 (フォーム) → TASK-5.2, TASK-5.3
                 │                            → TASK-8.2
                 └── TASK-5.1 (loading.tsx)

TASK-7.1 → TASK-7.2 → TASK-7.3 → TASK-7.8
TASK-7.4 → TASK-7.5
TASK-7.6 → TASK-7.7

TASK-6.1: Phase 2〜4完了後に実施（または並行して各タスク内で実施）
```

---

## 進捗追跡

| タスクID | 状態 | 完了日 |
|---------|------|-------|
| TASK-1.1 | ✅ 完了 | 2026-02-27 |
| TASK-1.2 | ✅ 完了 | 2026-02-27 |
| TASK-1.3 | ✅ 完了 | 2026-02-27 |
| TASK-2.1 | ✅ 完了 | 2026-02-28 |
| TASK-2.2 | ✅ 完了 | 2026-02-28 |
| TASK-2.3 | ✅ 完了 | 2026-02-28 |
| TASK-3.1 | ✅ 完了 | 2026-02-28 |
| TASK-3.2 | ✅ 完了 | 2026-02-28 |
| TASK-3.3 | ✅ 完了 | 2026-02-28 |
| TASK-3.4 | ✅ 完了 | 2026-02-28 |
| TASK-3.5 | ✅ 完了 | 2026-02-28 |
| TASK-3.6 | ✅ 完了 | 2026-02-28 |
| TASK-3.7 | ✅ 完了 | 2026-02-28 |
| TASK-3.8 | ✅ 完了 | 2026-02-28 |
| TASK-4.1 | ✅ 完了 | 2026-02-28 |
| TASK-4.2 | ✅ 完了 | 2026-02-28 |
| TASK-4.3 | ✅ 完了 | 2026-02-28 |
| TASK-4.4 | ✅ 完了 | 2026-02-28 |
| TASK-4.5 | ✅ 完了 | 2026-02-28 |
| TASK-4.6 | ✅ 完了 | 2026-02-28 |
| TASK-5.1 | ⬜ 未着手 | - |
| TASK-5.2 | ⬜ 未着手 | - |
| TASK-5.3 | ⬜ 未着手 | - |
| TASK-6.1 | ⬜ 未着手 | - |
| TASK-7.1 | ⬜ 未着手 | - |
| TASK-7.2 | ⬜ 未着手 | - |
| TASK-7.3 | ⬜ 未着手 | - |
| TASK-7.4 | ⬜ 未着手 | - |
| TASK-7.5 | ⬜ 未着手 | - |
| TASK-7.6 | ⬜ 未着手 | - |
| TASK-7.7 | ⬜ 未着手 | - |
| TASK-7.8 | ⬜ 未着手 | - |
| TASK-8.1 | ⬜ 未着手 | - |
| TASK-8.2 | ⬜ 未着手 | - |
| TASK-8.3 | ⬜ 未着手 | - |
| TASK-9.1 | ⬜ 未着手 | - |
| TASK-9.2 | ⬜ 未着手 | - |
| TASK-9.3 | ⬜ 未着手 | - |
