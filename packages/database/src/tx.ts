import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle, type NeonDatabase } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import * as schema from './schema';

// Node.js (v20系のCI含む) はグローバル WebSocket を持たないため、
// neon-serverless の Pool が使う WebSocket 実装を明示する必要がある。
// 参照: https://github.com/neondatabase/serverless/blob/main/CONFIG.md#websocketconstructor-typeof-websocket--undefined
neonConfig.webSocketConstructor = ws;

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
