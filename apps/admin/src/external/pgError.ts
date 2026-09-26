// PostgreSQL のエラーコード（SQLSTATE）判定。
// https://www.postgresql.org/docs/current/errcodes-appendix.html
//
// 【err.code だけでなく err.cause.code も見る】
// 実測（rehearsalブランチでの検証）で、drizzle-orm 0.45.1 は withTransaction
// （neon-serverless）経由の失敗を DrizzleQueryError でラップし、実際の pg エラー
// （code: '23505' 等）はトップレベルの `err.code` ではなく `err.cause.code` に入る。
// `err.code` だけを見る判定はラップされたケースを取りこぼす。
//
// packages/database は web / scripts と共有のため、admin 都合のこのヘルパーは
// external/ にローカルで置く（ADR-0001。requireInserted.ts と同じ方針）。
export const PG_UNIQUE_VIOLATION = '23505';
export const PG_FOREIGN_KEY_VIOLATION = '23503';

// pg エラーのフィールドを、err 自身と err.cause（DrizzleQueryError のラップ）の両方から読む
function pgFieldCandidates(err: unknown, key: 'code' | 'constraint'): unknown[] {
  const read = (e: unknown): unknown =>
    typeof e === 'object' && e !== null && key in e ? (e as Record<string, unknown>)[key] : undefined;
  const cause = typeof err === 'object' && err !== null && 'cause' in err
    ? (err as { cause: unknown }).cause
    : undefined;
  return [read(err), read(cause)];
}

export function isPgErrorCode(err: unknown, code: string): boolean {
  return pgFieldCandidates(err, 'code').includes(code);
}

// 違反した制約名。同じ 23505 でも制約ごとに意味が違う場合
// （例: unique_connection_route_label だけを 409 にしたい）に使う
export function pgConstraintName(err: unknown): string | undefined {
  return pgFieldCandidates(err, 'constraint').find((v): v is string => typeof v === 'string');
}
