import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { BRAND_COLORS, mantineTheme } from './mantineTheme';

const GLOBALS_CSS = path.resolve(__dirname, '../app/globals.css');
const BRAND_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const;

function readHexToken(css: string, name: string): string {
  const value = css.match(new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})\\s*;`))?.[1];
  if (!value) throw new Error(`globals.css に --${name} が見つからない`);
  return value.toUpperCase();
}

function readBrandScale(): string[] {
  const css = readFileSync(GLOBALS_CSS, 'utf-8');
  return BRAND_STEPS.map((step) => readHexToken(css, `brand-${step}`));
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

  it('Mantine の文字色（black）が globals.css の --neutral-900 と一致する', () => {
    const css = readFileSync(GLOBALS_CSS, 'utf-8');
    expect(mantineTheme.black?.toUpperCase()).toBe(readHexToken(css, 'neutral-900'));
  });
});
