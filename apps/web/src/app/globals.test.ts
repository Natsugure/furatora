import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const GLOBALS_CSS = path.resolve(__dirname, './globals.css');
const DIAGRAM_CSS = createRequire(import.meta.url).resolve('@furatora/platform-diagram/styles.css');

// globals.css と styles.css の両方の :root にある名前。web では読み込み順で勝つ側が決まるため、
// 値がずれると web と admin でホーム図の色が変わる（ADR-0017）
const SHARED_TOKENS = [
  'color-bg-card',
  'color-border-default',
  'color-border-strong',
  'color-text-primary',
  'color-text-secondary',
] as const;

// var(--x) をたどって 16 進の値まで解決する
function resolveHex(css: string, name: string): string {
  const value = css.match(new RegExp(`--${name}:\\s*([^;]+);`))?.[1]?.trim();
  if (!value) throw new Error(`--${name} が見つからない`);
  const ref = value.match(/^var\(--([\w-]+)\)$/)?.[1];
  if (ref) return resolveHex(css, ref);
  if (!/^#[0-9A-Fa-f]{6}$/.test(value)) throw new Error(`--${name} が 16 進の色ではない: ${value}`);
  return value.toUpperCase();
}

describe('globals.css', () => {
  it.each(SHARED_TOKENS)('--%s がホーム図の styles.css と同じ値', (name) => {
    const web = readFileSync(GLOBALS_CSS, 'utf-8');
    const diagram = readFileSync(DIAGRAM_CSS, 'utf-8');
    expect(resolveHex(web, name)).toBe(resolveHex(diagram, name));
  });
});
