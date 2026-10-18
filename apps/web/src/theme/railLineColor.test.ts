import { describe, expect, it } from 'vitest';
import { railLineColor } from './railLineColor';

describe('railLineColor', () => {
  it('路線色があれば、その色を返す', () => {
    expect(railLineColor('#F39700')).toBe('#F39700');
  });

  it.each([null, undefined, ''])('路線色が %o なら、代わりの色のトークンを返す', (color) => {
    expect(railLineColor(color)).toBe('var(--color-rail-line-fallback)');
  });
});
