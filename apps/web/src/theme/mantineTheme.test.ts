import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { BRAND_COLORS, mantineTheme } from './mantineTheme';

const GLOBALS_CSS = path.resolve(__dirname, '../app/globals.css');
const BRAND_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const;

function readBrandScale(): string[] {
  const css = readFileSync(GLOBALS_CSS, 'utf-8');
  return BRAND_STEPS.map((step) => {
    const value = css.match(new RegExp(`--brand-${step}:\\s*(#[0-9A-Fa-f]{6})\\s*;`))?.[1];
    if (!value) throw new Error(`globals.css に --brand-${step} が見つからない`);
    return value.toUpperCase();
  });
}

describe('mantineTheme', () => {
  it('ブランド色の10段階が globals.css の --brand-50〜--brand-900 と一致する', () => {
    expect(BRAND_COLORS.map((c) => c.toUpperCase())).toEqual(readBrandScale());
  });

  it('主色はブランド色の 600（白い文字を載せられる段階）', () => {
    expect(mantineTheme.primaryColor).toBe('brand');
    expect(mantineTheme.primaryShade).toBe(6);
    expect(BRAND_COLORS[6]).toBe('#C63D71');
  });
});
