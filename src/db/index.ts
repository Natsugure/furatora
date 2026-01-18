import 'dotenv/config';
import { neon, neonConfig } from '@neondatabase/serverless';
import { drizzle as drizzleHttp } from 'drizzle-orm/neon-http';
import ws from 'ws';

let connectionString = process.env.DATABASE_URL;

// Configuring Neon for local development
if (process.env.NODE_ENV === 'development') {
  connectionString = 'postgres://postgres:postgres@127.0.0.1:5432/main';
  neonConfig.fetchEndpoint = (host) => {
    const [protocol, port] = host === 'db.localtest.me' ? ['http', 4444] : ['https', 443];
    return `${protocol}://${host}:${port}/sql`;
  };
  const connectionStringUrl = new URL(connectionString);
  neonConfig.useSecureWebSocket = connectionStringUrl.hostname !== '127.0.0.1:5432';
  neonConfig.wsProxy = (host) => (host === 'db.localtest.me' ? `${host}:4444/v2` : `${host}/v2`);
}
neonConfig.webSocketConstructor = ws;

if (!connectionString) {
  throw new Error('DATABASE_URL is not defined');
}

const sql = neon(connectionString);

export const db = drizzleHttp({ client: sql });