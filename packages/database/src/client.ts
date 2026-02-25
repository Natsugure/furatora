import 'dotenv/config';
import postgres from 'postgres';
import { neon } from '@neondatabase/serverless'
import { drizzle as drizzleHttp } from 'drizzle-orm/neon-http';
import { drizzle as drizzlePg } from 'drizzle-orm/postgres-js';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not defined');
}

export const db = process.env.USE_LOCAL_DB === 'true' ? 
  drizzlePg({ client: postgres(connectionString), schema: schema }) :
  drizzleHttp({ client: neon(connectionString), schema: schema });