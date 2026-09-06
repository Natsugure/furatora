import { describe, it, expect } from 'vitest';
import { describeError } from './describeError';

describe('describeError', () => {
  it('error が文字列ならそのまま返す（422/409/404/500）', () => {
    expect(describeError({ error: 'この slug は既に使われている' })).toBe('この slug は既に使われている');
  });

  it('error が ZodIssue[] なら message を連結して返す（400）', () => {
    const body = {
      error: [
        { message: 'slug は英小文字・数字をハイフンで繋いだ形式のみ使用できる（先頭・末尾・連続のハイフンは不可）' },
      ],
    };
    expect(describeError(body)).toContain('ハイフン');
  });

  it('複数の ZodIssue は " / " で連結する', () => {
    const body = { error: [{ message: 'A' }, { message: 'B' }] };
    expect(describeError(body)).toBe('A / B');
  });

  it('想定外の形なら汎用文言を返す', () => {
    expect(describeError(null)).toBe('保存に失敗しました');
    expect(describeError({})).toBe('保存に失敗しました');
    expect(describeError({ error: [] })).toBe('保存に失敗しました');
    expect(describeError({ error: 42 })).toBe('保存に失敗しました');
  });
});
