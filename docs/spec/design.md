# 技術設計: Admin UI刷新 (Mantine v8導入)

## 概要

- **対象**: `apps/admin`
- **参照**: [`requirements.md`](./requirements.md)
- **作成日**: 2026-02-26

---

## アーキテクチャ概要

```
apps/admin/
├── src/
│   ├── app/
│   │   ├── layout.tsx          ← MantineProvider 追加
│   │   ├── page.tsx            ← ダッシュボード (Mantine統計カード)
│   │   ├── operators/          ← 【新規】オペレーター管理
│   │   │   ├── page.tsx
│   │   │   ├── new/page.tsx
│   │   │   └── [operatorId]/edit/page.tsx
│   │   ├── lines/              ← 【拡張】基本情報編集追加
│   │   │   ├── page.tsx
│   │   │   ├── new/page.tsx    ← 【新規】
│   │   │   ├── [lineId]/
│   │   │   │   ├── edit/page.tsx
│   │   │   │   └── directions/...
│   │   ├── stations/           ← 【拡張】基本情報編集追加
│   │   │   ├── [stationId]/
│   │   │   │   ├── edit/page.tsx ← 全フィールド対応
│   │   │   │   └── ...
│   │   └── unresolved-connections/
│   │       └── page.tsx        ← 【拡張】Gemini AI提案UI追加
│   ├── components/             ← 全コンポーネントをMantine化
│   │   ├── Sidebar.tsx         ← AppShell/NavLink移行
│   │   ├── DeleteButton.tsx    ← Button + Modal移行
│   │   ├── FacilityForm.tsx    ← Mantine Select/Checkbox等に移行
│   │   ├── PlatformForm.tsx    ← Mantine NumberInput/Select等に移行
│   │   ├── StationEditForm.tsx ← Mantine TextInput/Select等に移行
│   │   ├── TrainForm.tsx
│   │   ├── LineForm.tsx
│   │   ├── LineDirectionForm.tsx
│   │   ├── StationNotesForm.tsx
│   │   ├── ConnectionsEditSection.tsx
│   │   ├── OperatorForm.tsx    ← 【新規】
│   │   └── LoadingFallback.tsx ← 【新規】共通スケルトン
│   └── ...
```

---

## データフロー

既存のAPIルート・Server Actionsは変更せず、UIレイヤーのみ刷新する。

```
[管理者ブラウザ]
     │
     ▼
[Next.js App Router (apps/admin)]
     │
     ├── layout.tsx (MantineProvider)
     │
     ├── page components (Server Components)
     │     └── データ取得: fetch() or Server Actions
     │
     ├── 'use client' コンポーネント (Mantine UI)
     │     ├── フォーム送信 → fetch() API呼び出し
     │     └── 状態管理: useState / useForm (Mantine)
     │
     └── API Route Handlers (/api/*)
           └── DrizzleORM → NeonDB (PostgreSQL)
```

---

## コンポーネント設計

### レイアウト: AppShell移行

**現状**: カスタムCSSによるサイドバー固定レイアウト
**移行先**: Mantine `AppShell` + `AppShell.Navbar` + `AppShell.Main`

```tsx
// layout.tsx (概念)
<MantineProvider>
  <AppShell
    navbar={{ width: 220, breakpoint: 'sm', collapsed: { mobile: !opened } }}
    padding="md"
  >
    <AppShell.Navbar>
      <Sidebar />
    </AppShell.Navbar>
    <AppShell.Main>{children}</AppShell.Main>
  </AppShell>
</MantineProvider>
```

**レスポンシブ対応**: `breakpoint: 'sm'`でモバイル時にNavbarを折りたたみ、ハンバーガーボタンで開閉。

---

### フォームコンポーネント: Mantineフォーム要素

#### 主要な対応表

| 現状 (素のHTML) | 移行先 (Mantine) |
|----------------|-----------------|
| `<input type="text">` | `<TextInput>` |
| `<input type="number">` | `<NumberInput>` |
| `<textarea>` | `<Textarea>` |
| `<select>` | `<Select>` または `<NativeSelect>` |
| `<input type="checkbox">` | `<Checkbox>` / `<Checkbox.Group>` |
| `<button type="submit">` | `<Button type="submit" loading={submitting}>` |
| `<button type="button">` | `<Button variant="default">` |
| `alert()` | `<Modal>` による確認ダイアログ |
| エラーテキスト | `<Alert color="red">` |

#### FacilityForm.tsx の複雑度対応

- **ローディング**: 3つのfetchをuseEffect内で実行 → 個別のローディング状態 + `<Loader>`
- **設備タイプ選択**: チェックボックス + ネスト詳細 → `<Checkbox>` + `<Collapse>` or `<Card>`
- **接続駅選択**: 動的配列 → `<Select>` + `<ActionIcon>` (追加/削除ボタン)

#### PlatformForm.tsx の複雑度対応

- **連鎖選択** (路線 → 方向): `<Select>` の `onChange` で次の選択肢をAPIから取得
- **停車位置配列**: `<NumberInput>` の動的リスト + `<ActionIcon>` で追加/削除

---

### ローディング状態設計

#### スケルトンUI (ページ初期ロード)

Server Componentsのデータ取得中は、Next.js の `loading.tsx` + Mantine `<Skeleton>` を使用。

```tsx
// app/stations/loading.tsx
import { Skeleton } from '@mantine/core';

export default function Loading() {
  return (
    <div>
      <Skeleton height={40} mb="md" />
      <Skeleton height={200} />
    </div>
  );
}
```

#### ドロップダウン取得中のスピナー

```tsx
// Client Component内
const [loading, setLoading] = useState(true);
// ...
{loading ? <Loader size="sm" /> : <Select data={options} />}
```

#### フォーム送信中の待機表示

```tsx
<Button type="submit" loading={submitting}>
  {isEdit ? '更新' : '登録'}
</Button>
```

---

### 新規ページ設計

#### Operatorsページ

```
GET  /api/operators         → 一覧取得
POST /api/operators         → 新規作成
PUT  /api/operators/:id     → 更新
DELETE /api/operators/:id   → 削除
```

- 既存の `/api/operators` ルートを確認・必要に応じて拡張
- `OperatorForm.tsx`: TextInput (名称・ODPTコード等)

#### Lines拡張

- 現在の `/lines` は表示のみで、よみがな編集のみ可能
- `LineForm.tsx` を拡張: ODPTコード・名称・オペレーター選択等のフィールド追加
- 対応するAPIルートを確認・拡張

#### Stations基本情報拡張

- 現在の `/stations/[stationId]/edit` はよみがな・備考・乗り換え接続難易度のみ
- `StationEditForm.tsx` を拡張: 駅コード・名称・オペレーター・路線等のフィールド追加

---

### Gemini AI連携設計 (P3)

```
[管理者] → [未解決接続ページ]
                    │
              [AI提案ボタン]
                    │
              Server Action
                    │
         Google Gemini API (無料枠)
                    │
         { jaName: string, lineCode: string }
                    │
            フォームに自動入力 (編集可能)
                    │
              [保存ボタン]
```

- `GEMINI_API_KEY` を環境変数で管理
- Server Actionでのみ呼び出し（APIキーをクライアントに露出しない）

---

## エラーハンドリング

| エラー種別 | 現状 | 移行後 |
|-----------|------|--------|
| フォーム送信失敗 | `alert('Failed to save')` | `<Alert color="red">` でインライン表示 |
| 必須項目未入力 | `alert('...')` | Mantine フォームバリデーション (`error` prop) |
| API通信エラー | なし | `<Notification>` または `<Alert>` |
| データ取得失敗 | なし | エラーバウンダリー + 再試行ボタン |

---

## テスト戦略

本プロジェクトはE2EテストフレームワークおよびUnit testフレームワークが現時点で未導入。

- **ビルド確認**: `pnpm run build` で型エラー・コンパイルエラーがないことを確認
- **手動テスト**: 各フォームの送信・バリデーション・ローディング状態を目視確認
- **リグレッション確認**: 既存のCRUD操作が引き続き動作することを確認

---

## 実装上の考慮事項

### TailwindCSS v4 との共存

Mantine v8はCSS-in-JSを使用しており、TailwindCSSと共存可能。ただし:
- MantineコンポーネントへのTailwindクラス直接適用は非推奨（`className`は使えるが、Mantineのスタイルシステムを優先）
- レイアウト補助（`gap`等）にはTailwindを限定的に使用可

### MantineProvider設定

```tsx
// ColorSchemeScript を <head> に追加してフラッシュを防止
// ColorScheme はデフォルト 'light' で固定（ダークモードは将来対応）
```

### パッケージインストール

```bash
# apps/admin で実行
pnpm add @mantine/core @mantine/hooks
```

Mantine v8はReact 18+対応。現在のadminはReact 19なので互換性あり。

### PostCSS設定

Mantine v8はPostCSS経由でCSSをインポート。現在TailwindCSS用のPostCSS設定が存在するため、Mantine用の設定を追加（または確認）が必要。

```js
// postcss.config.js に追加が必要か確認
// @mantine/core/styles.css をlayout.tsxでインポート
```
