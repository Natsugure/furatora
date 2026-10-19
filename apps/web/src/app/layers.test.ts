import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const LAYERS_CSS = readFileSync(path.resolve(__dirname, './layers.css'), 'utf-8');
const LAYOUT_TSX = readFileSync(path.resolve(__dirname, './layout.tsx'), 'utf-8');

// layout.tsx が読み込む CSS（.css で終わる import）を、書かれている順に返す
function cssImports(source: string): string[] {
  return [...source.matchAll(/^import\s+'([^']+\.css)';/gm)].map((m) => m[1] ?? '');
}

describe('CSS レイヤーの順序', () => {
  it('mantine を Tailwind の base より上、utilities より下に置く', () => {
    const order = LAYERS_CSS.match(/^@layer\s+([^;{]+);/m)?.[1]?.split(',').map((s) => s.trim());
    expect(order).toBeDefined();
    const at = (name: string) => order?.indexOf(name) ?? -1;
    // preflight（base）が Mantine の部品の見た目を消さない
    expect(at('base')).toBeGreaterThanOrEqual(0);
    expect(at('mantine')).toBeGreaterThan(at('base'));
    // Mantine のリセット（button { font: inherit }）が font-bold などに勝たない
    expect(at('utilities')).toBeGreaterThan(at('mantine'));
  });

  it('layout.tsx は layers.css を最初の CSS として読む', () => {
    // レイヤーの優先順位は最初に現れた順で決まるため、他の CSS より後だと宣言が効かない
    expect(cssImports(LAYOUT_TSX)[0]).toBe('./layers.css');
  });

  it('layout.tsx は Mantine をレイヤーに入った版で読む', () => {
    const imports = cssImports(LAYOUT_TSX);
    expect(imports).toContain('@mantine/core/styles.layer.css');
    expect(imports).not.toContain('@mantine/core/styles.css');
  });
});
