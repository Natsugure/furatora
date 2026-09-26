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

function errorCode(err: unknown): unknown {
  return typeof err === 'object' && err !== null && 'code' in err
    ? (err as { code: unknown }).code
    : undefined;
}

export function isPgErrorCode(err: unknown, code: string): boolean {
  if (errorCode(err) === code) return true;
  const cause = typeof err === 'object' && err !== null && 'cause' in err
    ? (err as { cause: unknown }).cause
    : undefined;
  return errorCode(cause) === code;
}

// 違反した制約名（一意制約違反 23505 などで pg エラーが持つ `constraint`）。
// errorCode と同じ理由で err.cause も見る。同じ 23505 でも制約ごとに意味が違う場合
// （例: unique_connection_route_label だけを 409 にしたい）に使う
export function pgConstraintName(err: unknown): string | undefined {
  const read = (e: unknown): unknown =>
    typeof e === 'object' && e !== null && 'constraint' in e ? (e as { constraint: unknown }).constraint : undefined;
  const direct = read(err);
  if (typeof direct === 'string') return direct;
  const cause = typeof err === 'object' && err !== null && 'cause' in err ? (err as { cause: unknown }).cause : undefined;
  const fromCause = read(cause);
  return typeof fromCause === 'string' ? fromCause : undefined;
}
