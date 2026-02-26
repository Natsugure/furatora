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
- Server Componentでは`fetch`を直接使用し、`cache`オプションを明示的に指定
- `cache: 'force-cache'`（静的）、`cache: 'no-store'`（動的）、`next: { revalidate: N }`（ISR）を適切に選択
- React の`cache()`関数でサーバーサイドのリクエストを重複排除
- Server Actionsでデータ変更後は`revalidatePath`・`revalidateTag`でキャッシュを更新
- クライアントサイドのサーバー状態管理にはReact Query（TanStack Query）またはSWRを使用

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
app/
  (auth)/           # Route Group: 認証関連ページ
  (dashboard)/      # Route Group: ダッシュボード関連ページ
  api/              # Route Handlers（APIエンドポイント）
  layout.tsx        # ルートレイアウト
components/
  ui/               # 汎用UIコンポーネント（Client/Server）
  features/         # 機能別コンポーネント
lib/
  db/               # DBクライアント（Prisma等）
  actions/          # Server Actions
  utils/            # ユーティリティ関数
hooks/              # カスタムフック（Client Component用）
types/              # 型定義
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
- アプリ全体の共有状態にはZustandまたはJotaiを使用（サーバー状態はReact Queryに分離）
- Server ComponentはContextを使用できないため、`cookies()`・`headers()`からセッション情報を取得

### パフォーマンス最適化
- `next/image`の`Image`コンポーネントを画像最適化に使用（`width`・`height`またはfillを必ず指定）
- `next/font`でフォントを最適化し、レイアウトシフトを防止
- `next/link`の`Link`コンポーネントでクライアントサイドナビゲーションとプリフェッチを活用
- `next/dynamic`でClient Componentを遅延読み込み（`ssr: false`オプションを適切に設定）
- Streaming SSRを活用し、`loading.tsx`または`<Suspense>`でローディングUIを実装
- `generateMetadata`で動的メタデータを生成しSEOを最適化

### データベースアクセス
- ORMはPrismaを推奨。DBクライアントはシングルトンとして管理
- DBアクセスはServer ComponentまたはServer Actions・Route Handlersのみで実施（クライアントからの直接アクセス禁止）
- N+1問題を防ぐためにクエリを適切に最適化（`include`・`select`の活用）
- マイグレーションはPrisma Migrateで管理

### 認証と認可
- 認証にはAuth.js（NextAuth.js v5）を使用
- セッション情報はServer Componentで`auth()`、Client Componentで`useSession()`から取得
- `middleware.ts`でルート保護を実装し、未認証ユーザーをリダイレクト
- Roleベースのアクセス制御（RBAC）をServer Actions・Route Handlers内で実装

### エラーハンドリング
- `error.tsx`でルートセグメントごとのエラーバウンダリを実装（`'use client'`必須）
- `not-found.tsx`で404ページを実装し、`notFound()`関数で呼び出し
- Server ActionsではtryAndcatchで例外を捕捉し、型安全なエラーレスポンスを返却
- Route Handlersでは適切なHTTPステータスコードを返却

### フォームとバリデーション
- フォーム処理はServer Actionsを優先し、JavaScriptなしでも動作するよう設計（Progressive Enhancement）
- スキーマバリデーションにはZodを使用し、サーバー・クライアント両方でバリデーション
- React Hook Formを使用する場合はServer Actionsと組み合わせて実装
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
- ユニットテスト・統合テストにはJest + React Testing Libraryを使用
- E2EテストにはPlaywrightを使用
- Server Actionsのテストはモックを活用してビジネスロジックを独立してテスト
- Route Handlersは`NextRequest`を使ってユニットテストを実装

## 実装プロセス
1. App Routerのディレクトリ構成とデータフローを計画
2. TypeScriptインターフェース・Zodスキーマを定義
3. DBスキーマ（Drizzle ORM）とマイグレーションを設計
4. Server Componentとlayout階層を実装
5. Server ActionsとRoute Handlersを実装
6. Client Componentを必要な箇所のみに実装
7. 認証・認可を実装
8. エラーハンドリング・ローディングUIを実装
9. `generateMetadata`でSEO設定を追加
10. テストカバレッジを追加
11. パフォーマンス最適化（画像・フォント・キャッシュ戦略）
12. セキュリティ監査と環境変数の確認

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