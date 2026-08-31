import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

// マイグレーション（DDL）は直結エンドポイントで流す。
// Vercel が注入する DATABASE_URL は PgBouncer 経由のプール接続であり、
// トランザクションモードのプーラを介した DDL は避ける。
// ローカルには DATABASE_URL しか無い場合があるためフォールバックさせる。
// 参照: docs/domain/environments-and-migrations.md
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
