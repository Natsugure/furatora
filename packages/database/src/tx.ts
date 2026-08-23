import { Pool } from '@neondatabase/serverless';
import { drizzle, type NeonDatabase } from 'drizzle-orm/neon-serverless';
import * as schema from './schema';

// 【実行環境の制約】neon-serverless の Pool は接続にグローバル `WebSocket` を使う。
// これを標準搭載するのは Node.js v22 以降であり、v20 以下では書き込み系が
// すべて `fetch failed` で落ちる（読み取りの neon-http は影響を受けないため、
// 「読めるのに書けない」形で表面化する。ADR-0005 追記参照）。
// そのため package.json の engines.node で v22 以上を要求している。
// `neonConfig.webSocketConstructor = ws` による差し替えを再導入するのではなく、
// 実行環境（CI・Vercel のNode.jsバージョン設定）を v22 以上に保つこと。

type TxCallback = Parameters<NeonDatabase<typeof schema>['transaction']>[0];
export type Tx = Parameters<TxCallback>[0];

export async function withTransaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not defined');
  }

  const pool = new Pool({ connectionString });
  try {
    return await drizzle(pool, { schema }).transaction(fn);
  } finally {
    await pool.end();
  }
}
