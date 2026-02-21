import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

const url = new URL(process.env.DATABASE_URL!);
url.searchParams.set('options', '-c search_path=public');

export default defineConfig({
  out: './drizzle',
  schema: './src/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: url.toString(),
  },
});
