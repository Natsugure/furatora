import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// 色の値の正は globals.css と @furatora/platform-diagram/styles.css のトークン（REQ-1）。
// globals.css で Tailwind の既定の色を無効にした（--color-*: initial）ので、既定の色クラスは
// エラーにならずに色が付かなくなるだけ。ここで残りが無いことを確かめる（REQ-4）
const REPO_ROOT = path.resolve(__dirname, '../../../..');
const SCAN_DIRS = ['apps/web/src', 'packages/platform-diagram/src'];

// mauve・olive・mist・taupe は Tailwind v4.2 で増えた名前。今の版（4.1）に無くても、上げたときに漏れないよう入れておく
const DEFAULT_PALETTE =
  'slate|gray|zinc|neutral|stone|mauve|olive|mist|taupe|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose';
const COLOR_UTILITY =
  'bg|text|border|border-[trblxy]|ring|ring-offset|divide|outline|fill|stroke|from|via|to|placeholder|decoration|accent|caret|shadow';
const DEFAULT_COLOR_CLASS = new RegExp(`(?<![\\w-])(?:${COLOR_UTILITY})-(?:(?:${DEFAULT_PALETTE})-\\d{2,3}|black)\\b`, 'g');
// 16進の色（'#fff' / '1px solid #ccc' / `${w}px solid #fff` / bg-[#123456]）。
// 「Issue #107」のようなコメントの中の番号は、走査の前にコメントを取り除くことで拾わない（codeOnly）
const HEX_COLOR = /(?<![\w&])#(?:[0-9a-fA-F]{3}){1,2}(?:[0-9a-fA-F]{2})?\b/g;

// 意図した例外。理由を添えて、行の単位で許す
const ALLOWED: { file: string; line: RegExp; reason: string }[] = [
  {
    file: 'apps/web/src/theme/mantineTheme.ts',
    line: /'#[0-9A-F]{6}'/,
    reason: 'Mantine の theme は CSS 変数を受け付けないため、ブランド色の10段階と black を複製している。mantineTheme.test.ts で globals.css と一致を確かめている（ADR-0017 決定5）',
  },
  {
    file: 'packages/platform-diagram/src/domain/concourse.ts',
    line: /DEFAULT_LINE_COLOR = /,
    reason: 'DB に路線色が無い路線の代わりの色（ホーム図。PR 4 で見直す）',
  },
];

function listFiles(dir: string, extension: RegExp): string[] {
  return readdirSync(path.join(REPO_ROOT, dir), { recursive: true, encoding: 'utf-8' })
    .filter((f) => extension.test(f) && !/\.test\.tsx?$/.test(f) && !f.endsWith('.d.ts'))
    .map((f) => path.join(dir, f));
}

const sourceFiles = (dir: string) => listFiles(dir, /\.tsx?$/);
const cssFiles = (dir: string) => listFiles(dir, /\.css$/);

// コメント（// …、/* … */、複数行の /* … */ の途中の行）を空白に置き換える。行番号は保つ。
// URL の // を誤って消さないよう、// は直前が : でないときだけコメントとみなす
function codeOnly(source: string): string[] {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '))
    .split('\n')
    .map((line) => line.replace(/(?<!:)\/\/.*$/, ''));
}

// 走査の対象の行（例外を除く）。ファイルを読むのは1回だけにして、各テストで使い回す
function scannedLines(files: string[]) {
  return files.flatMap((file) =>
    codeOnly(readFileSync(path.join(REPO_ROOT, file), 'utf-8'))
      .map((text, i) => ({ where: `${file}:${i + 1}`, text }))
      .filter(({ text }) => !ALLOWED.some((a) => a.file === file && a.line.test(text))),
  );
}

const SOURCE_LINES = scannedLines(SCAN_DIRS.flatMap(sourceFiles));
// CSS は @apply の既定の色クラスだけを見る。16進の色は、globals.css と styles.css がトークンの値の正として持つため見ない
const CSS_LINES = scannedLines(SCAN_DIRS.flatMap(cssFiles));

function violations(lines: { where: string; text: string }[], pattern: RegExp): string[] {
  return lines.flatMap(({ where, text }) => [...text.matchAll(pattern)].map((m) => `${where} ${m[0]}`));
}

describe('既定の色を使っていない', () => {
  it('Tailwind の既定の色クラスが無い', () => {
    expect(violations(SOURCE_LINES, DEFAULT_COLOR_CLASS)).toEqual([]);
  });

  it('CSS の @apply にも Tailwind の既定の色クラスが無い', () => {
    expect(violations(CSS_LINES, DEFAULT_COLOR_CLASS)).toEqual([]);
  });

  it('トークンを通さない16進の色が無い（路線色など DB から来る色は除く）', () => {
    expect(violations(SOURCE_LINES, HEX_COLOR)).toEqual([]);
  });

  it('走査の対象のファイルがある（パスの誤りで空振りしない）', () => {
    expect(sourceFiles('apps/web/src').length).toBeGreaterThan(10);
    expect(sourceFiles('packages/platform-diagram/src').length).toBeGreaterThan(5);
    expect(cssFiles('apps/web/src')).toContain('apps/web/src/app/globals.css');
    expect(cssFiles('packages/platform-diagram/src')).toContain('packages/platform-diagram/src/styles.css');
  });
});

// 検出の漏れを防ぐため、パターンそのものを確かめる（走査の結果が空でも、パターンが緩ければ通ってしまう）
describe('色の検出のパターン', () => {
  const matches = (pattern: RegExp, text: string) => [...text.matchAll(pattern)].map((m) => m[0]);

  it.each([
    "style={{ border: '1px solid #ccc' }}",
    'border: `${w}px solid #fff`',
    "color: '#FFFFFF'",
    'className="bg-[#123456]"',
  ])('16進の色を拾う: %s', (text) => {
    expect(matches(HEX_COLOR, text)).toHaveLength(1);
  });

  it('コメントの中の番号は拾わない', () => {
    const lines = codeOnly('// Issue #107\nconst a = 1; /* #fff */\n/*\n * #abc\n */');
    expect(lines.flatMap((line) => matches(HEX_COLOR, line))).toEqual([]);
  });

  it('URL の // をコメントとみなさない', () => {
    expect(codeOnly("const u = 'https://example.com'; const c = '#fff';")[0]).toContain('#fff');
  });

  it.each(['@apply text-gray-500;', 'bg-taupe-200', 'border-x-mauve-100', 'text-black'])('既定の色クラスを拾う: %s', (text) => {
    expect(matches(DEFAULT_COLOR_CLASS, text)).toHaveLength(1);
  });
});
