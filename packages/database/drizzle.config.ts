import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

// Drizzle Kit のマイグレーションは直結（非プール）エンドポイントで流す。
// Neon のプーラは PgBouncer のトランザクションモード固定であり、SET や
// セッションレベルのアドバイザリロックが使えない。DDL 文そのものではなく、
// それらに依存しうるマイグレーションツール側が理由である。
// Vercel が注入する DATABASE_URL はプール接続である。
// ローカルには DATABASE_URL しか無い場合があるためフォールバックさせる。
// 参照: docs/adr/0008-environment-database-branch-mapping.md
const connectionString =
  process.env.MIGRATION_DATABASE_URL ??
  process.env.DATABASE_URL_UNPOOLED ??
  process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    'No migration connection string is defined. Set MIGRATION_DATABASE_URL, DATABASE_URL_UNPOOLED, or DATABASE_URL.',
  );
}

const url = new URL(connectionString);
url.searchParams.set('options', '-c search_path=public');

export default defineConfig({
  out: './drizzle',
  schema: './src/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: url.toString(),
  },
});
