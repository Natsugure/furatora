// 公開操作 API のエラーレスポンスを、通知に出す1文へ変換する。
//
// route.ts のレスポンス形は2種類ある:
//   - 422/409/404/500 と「不正な JSON」: { error: string }
//   - 400（Zod バリデーション失敗）:        { error: ZodIssue[] }
// 文字列だけを見る実装だと、slug 形式エラー（400）が常に汎用文言に潰れる。
export function describeError(body: unknown): string {
  if (body && typeof body === 'object' && 'error' in body) {
    const { error } = body as { error: unknown };
    if (typeof error === 'string') return error;
    if (Array.isArray(error)) {
      const messages = error
        .map((issue) =>
          issue && typeof issue === 'object' && 'message' in issue
            ? String((issue as { message: unknown }).message)
            : null,
        )
        .filter((m): m is string => !!m);
      if (messages.length > 0) return messages.join(' / ');
    }
  }
  return '保存に失敗しました';
}
