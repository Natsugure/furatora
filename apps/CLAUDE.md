---
description: "Next.js App Routerのコーディング規約"
applyTo: "apps/**"
---

# Next.js開発指示書

https://nextjs.org/docs の公式Next.jsドキュメントに従った、モダンなパターン、App Router、ベストプラクティスを用いた高品質なNext.jsアプリケーションを構築するための指示書です。

## プロジェクトコンテキスト
- 最新のNext.jsバージョン（Next.js 16+）
- 型安全性のためのTypeScript
- App Router（`app/`ディレクトリ）をデフォルトとして使用
- React Server Components（RSC）を基本として設計
- フックを使用した関数コンポーネント（Client Componentのみ）
- モダンなビルドツールとしてTurbopackを活用

## アーキテクチャ

### App RouterとRouting
- `app/`ディレクトリでApp Routerを使用し、ファイルベースルーティングを実装
- `page.tsx`、`layout.tsx`、`loading.tsx`、`error.tsx`、`not-found.tsx`などの特殊ファイルを適切に活用
- Route Groups（`(groupName)/`）でフォルダを整理し、URLに影響させない
- Parallel RoutesとIntercepting Routesを必要に応じて実装
- Dynamic Routes（`[slug]`、`[...slug]`、`[[...slug]]`）を適切に使用
- `generateStaticParams`で静的パスを事前生成

### Server ComponentsとClient Components
- デフォルトはServer Componentとして設計し、必要な場合のみClient Componentに変換
- `'use client'`ディレクティブはインタラクティビティや状態が必要な末端コンポーネントにのみ付与
- Server ComponentからClient Componentへのデータ受け渡しはpropsを通じてシリアライズ可能な値のみを渡す
- Server ComponentはDB・APIアクセス、機密情報の処理を担当
- Client ComponentはUI状態管理、イベントハンドリング、ブラウザAPIを担当

### データフェッチングとキャッシュ
- Server ComponentではDrizzle ORMを使って直接DBクエリを実行する
- `cache: 'force-cache'`（静的）、`cache: 'no-store'`（動的）、`next: { revalidate: N }`（ISR）を適切に選択
- React の`cache()`関数でサーバーサイドのリクエストを重複排除
- Server Actionsでデータ変更後は`revalidatePath`・`revalidateTag`でキャッシュを更新
- Client ComponentからのデータフェッチはRoute Handlers（`/api/`）への`fetch()`を使用する

### Server Actions
- フォーム送信やデータ変更処理は`'use server'`ディレクティブを付与したServer Actionsで実装
- `useFormState`・`useFormStatus`（React 19では`useActionState`）でフォームの状態管理
- Server ActionsはZodなどでサーバーサイドバリデーションを必ず実装
- 楽観的更新には`useOptimistic`を活用

## 開発標準

### TypeScript統合
- props、state、APIレスポンス型にTypeScriptインターフェースを使用
- `next/types`の型（`Metadata`、`NextPage`、`NextRequest`など）を活用
- `tsconfig.json`でstrictモードを有効化
- APIルートのリクエスト・レスポンスに適切な型を定義

### ディレクトリ構成
```
src/
  app/
    api/              # Route Handlers（APIエンドポイント）
    [feature]/        # 機能別ページ（Dynamic Routes含む）
    error.tsx         # エラーバウンダリ（'use client'必須）
    layout.tsx        # ルートレイアウト
    not-found.tsx     # 404ページ
    page.tsx          # トップページ
  components/
    ui/               # 汎用UIコンポーネント
    [ComponentName].tsx  # 機能別コンポーネント
  constants/          # 定数定義
  lib/                # ユーティリティ・バリデーション（必要な場合）
  types/              # 型定義
  auth.ts             # NextAuth設定（admin appのみ）
  middleware.ts       # 認証ミドルウェア（admin appのみ）
```

### Route Handlers（APIルート）
- `app/api/`配下に`route.ts`でAPIエンドポイントを実装
- `NextRequest`・`NextResponse`を使用して型安全に実装
- HTTPメソッドごとに名前付きエクスポート（`GET`、`POST`、`PUT`、`DELETE`）で定義
- 認証・認可ミドルウェアを`middleware.ts`で実装
- APIレスポンスは統一されたフォーマットで返却

### 状態管理
- グローバル状態はURL（`useSearchParams`・`useRouter`）での管理を優先
- Client ComponentのローカルUI状態には`useState`・`useReducer`を使用
- Server ComponentはContextを使用できないため、`cookies()`・`headers()`からセッション情報を取得

### パフォーマンス最適化
- `next/image`の`Image`コンポーネントを画像最適化に使用（`width`・`height`またはfillを必ず指定）
- `next/font`でフォントを最適化し、レイアウトシフトを防止
- `next/link`の`Link`コンポーネントでクライアントサイドナビゲーションとプリフェッチを活用
- `next/dynamic`でClient Componentを遅延読み込み（`ssr: false`オプションを適切に設定）
- Streaming SSRを活用し、`loading.tsx`または`<Suspense>`でローディングUIを実装
- `generateMetadata`で動的メタデータを生成しSEOを最適化

### データベースアクセス
- ORMはDrizzle ORMを使用。DBクライアントは`@furatora/database/client`パッケージからインポートする
- DBアクセスはServer ComponentまたはServer Actions・Route Handlersのみで実施（クライアントからの直接アクセス禁止）
- N+1問題を防ぐためにクエリを適切に最適化（`with`・`columns`の活用）
- マイグレーションはDrizzle Kit（`db:generate` → `db:migrate`）で管理
- スキーマ定義はすべて`packages/database/src/schema.ts`に集約されている

### 認証と認可
- 認証は**admin appのみ**で実装。web appは認証不要の公開サービス
- admin appではAuth.js（NextAuth.js v5）+ GitHubプロバイダーを使用
- セッション情報はServer Componentで`auth()`から取得
- `middleware.ts`でルート保護を実装し、未認証ユーザーを`/login`へリダイレクト

### エラーハンドリング
- `error.tsx`でルートセグメントごとのエラーバウンダリを実装（`'use client'`必須）
- `not-found.tsx`で404ページを実装し、`notFound()`関数で呼び出し
- Server ActionsではtryAndcatchで例外を捕捉し、型安全なエラーレスポンスを返却
- Route Handlersでは適切なHTTPステータスコードを返却

### フォームとバリデーション
- フォーム処理はServer Actionsを優先し、JavaScriptなしでも動作するよう設計（Progressive Enhancement）
- スキーマバリデーションにはZodを使用し、サーバーサイドでバリデーション
- `useFormStatus`でPending状態を管理し、二重送信を防止

### スタイリング
- TailwindCSSをデフォルトとして使用
- コンポーネントライブラリはMantine v8を推奨
- グローバルスタイルは`app/globals.css`に定義
- CSSモジュールやCSS-in-JSを使用する場合は統一されたアプローチを採用

### セキュリティ
- Server ActionsとRoute Handlersで必ずCSRF対策・入力バリデーションを実施
- 環境変数はサーバー専用（`NEXT_PUBLIC_`なし）とクライアント公開用（`NEXT_PUBLIC_`あり）を適切に分離
- `next.config.ts`でSecurityヘッダーを設定（CSP、X-Frame-Optionsなど）
- SQLインジェクションを防ぐためORMのパラメータ化クエリを必ず使用
- 機密情報はlocalStorage・sessionStorageに保存しない

### アクセシビリティ
- セマンティックHTML要素を適切に使用
- 適切なARIA属性とロールを実装
- キーボードナビゲーションをすべてのインタラクティブ要素で確保
- `next/image`のalt属性を必ず設定
- 適切なカラーコントラスト比を実装

### テスト

**テストスタック**
- ユニット・統合テスト: **Vitest** + **React Testing Library**
- E2Eテスト: **Playwright**

**テスト戦略（コンポーネント種別ごと）**
- **Client Component**: React Testing Libraryでレンダリングし、ユーザーインタラクションをテスト
- **Server Actions**: 純粋な非同期関数として単体テスト（DBはモック）
- **Route Handlers**: `NextRequest`を生成してユニットテスト
- **Server Component**: RSCは直接ユニットテストできないため、Playwright E2Eでカバーする

**テストファイルの配置**
- ユニット・統合テスト: テスト対象ファイルと同階層に `*.test.ts(x)` として配置
- E2Eテスト: `e2e/` ディレクトリにまとめる

**テスト記述の方針**
- 実装の詳細ではなくユーザーから見た動作をテストする（"what", not "how"）
- Server Actionsのテストでは正常系・バリデーションエラー・DB例外の各ケースをカバーする
- Client ComponentはMantineやTailwindのクラスではなくセマンティックなクエリ（`getByRole`・`getByLabelText`等）で検証する

## 実装プロセス
1. App Routerのディレクトリ構成とデータフローを計画
2. TypeScriptインターフェース・Zodスキーマを定義
3. `packages/database/src/schema.ts`にDBスキーマを追加し、マイグレーションを設計
4. Server Componentとlayout階層を実装
5. Server ActionsとRoute Handlersを実装
6. Client Componentを必要な箇所のみに実装
7. 認証・認可を実装（admin appのみ）
8. エラーハンドリング・ローディングUIを実装
9. `generateMetadata`でSEO設定を追加
10. Server Actions・Route Handlersのユニットテストを追加
11. Playwright E2Eテストで主要ユーザーフローを検証
12. パフォーマンス最適化（画像・フォント・キャッシュ戦略）
13. セキュリティ監査と環境変数の確認

## 追加ガイドライン
- Reactの命名規則に従う（コンポーネントにはPascalCase、関数にはcamelCase）
- Server ComponentとClient Componentを明確に区別するため、ファイル名に`*.client.tsx`サフィックスを検討
- `next.config.ts`でexperimental機能を必要に応じて有効化
- ESLintは`eslint-config-next`を使用し、Next.js固有のルールを適用
- 依存関係を最新に保ちセキュリティ脆弱性を監査（`npm audit`）
- 本番環境では`next build`・`next start`を使用し、Vercelへのデプロイを推奨

## 一般的なパターン
- データ取得はServer Componentで実施し、Client Componentへpropsで渡す
- `<Suspense>`境界を活用してStreaming SSRを実現
- Server ActionsをServer ComponentとClient Component両方から呼び出す
- Route HandlersはサードパーティWebhookや外部APIからのリクエスト受け口として活用
- Middlewareでの認証チェックとリダイレクト処理
- `generateStaticParams`によるSSGとISRの組み合わせで最適なパフォーマンスを実現