import { describe, it, expect } from 'vitest';
import { uuidSchema } from './uuid';

const LOWER = '0192abcd-1234-7abc-8def-0123456789ab';

describe('uuidSchema', () => {
  it('大文字の UUID を小文字にして返す', () => {
    expect(uuidSchema.parse(LOWER.toUpperCase())).toBe(LOWER);
  });

  it('UUID の形でない値は失敗する', () => {
    expect(uuidSchema.safeParse('not-a-uuid').success).toBe(false);
  });
});
