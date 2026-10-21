import { describe, expect, it } from 'vitest';
import { formationLabel } from './formation';

describe('formationLabel', () => {
  it('列車が1つなら、その両数の編成', () => {
    expect(formationLabel([{ carCount: 10 }])).toBe('10両編成');
  });

  it('両数の違う列車が来る番線は、入力の順によらず小さい順に「・」でつなぐ', () => {
    expect(formationLabel([{ carCount: 10 }, { carCount: 8 }])).toBe('8・10両編成');
  });

  it('両数の同じ列車が複数あっても重ねない', () => {
    expect(formationLabel([{ carCount: 10 }, { carCount: 10 }, { carCount: 15 }])).toBe('10・15両編成');
  });

  it('列車が無ければ null', () => {
    expect(formationLabel([])).toBeNull();
  });
});
