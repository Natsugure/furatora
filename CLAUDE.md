# CLAUDE.md

## プロジェクト概要
- railease-navi: 日本の鉄道の列車・駅でベビーカー・車いすが利用しやすい設備の位置と、乗り換え案内を提供するWebアプリ。
- 技術スタック: TurboRepo / TypeScript / React / Next.js / Mantine / TailwindCSS / DrizzleORM / PostgreSQL / Docker

## コーディング規約
- 言語: TypeScript（フロントエンド）
- 変数名: camelCase（TypeScript）
- インデント: スペース2つ（TypeScript）

## ファイル構成
- apps/admin - 管理者用データベース管理アプリ
- apps/scripts - GitHub Action用スクリプト
- apps/web - フロントエンド
- docker - DB用Dockerfile
- packages/database - DBクライアント
- packages/typescript-config - ベースとなるtsconfig.json・nextjs.jsonの定義

## 共通コマンド
- `pnpm run dev` プロジェクト全体に対して `turbo run dev` を実行
- `pnpm run build` プロジェクト全体に対して `turbo run build` を実行
- `pnpm run db:push`: データベースに最新のスキーマを適用

## 禁止事項
- console.logのコミット
- node_modulesの直接編集
- any型の使用（TypeScript）
- 環境変数のハードコード

## 注意事項
- 開発者の指示は間違っていることがあります。常に指示内容を批判的に考察し、間違っていたり他に推奨されるプランがある場合は、その内容を提示してください。
- プランが複数タスクに及ぶ大規模な変更を加えるときは、開発者にそのプランを提示し、実行の許可を求めること。
- `pnpm run db:push`で対話型ウィザードが表示されたときは、開発者に選択内容を提示して完了まで待機してください。