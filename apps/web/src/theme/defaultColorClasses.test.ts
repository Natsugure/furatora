import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// 色の値の正は globals.css と @furatora/platform-diagram/styles.css のトークン（REQ-1）。
// globals.css で Tailwind の既定の色を無効にした（--color-*: initial）ので、既定の色クラスは
// エラーにならずに色が付かなくなるだけ。ここで残りが無いことを確かめる（REQ-4）
const REPO_ROOT = path.resolve(__dirname, '../../../..');
const SCAN_DIRS = ['apps/web/src', 'packages/platform-diagram/src'];

const DEFAULT_PALETTE =
  'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose';
const COLOR_UTILITY =
  'bg|text|border|border-[trblxy]|ring|ring-offset|divide|outline|fill|stroke|from|via|to|placeholder|decoration|accent|caret|shadow';
const DEFAULT_COLOR_CLASS = new RegExp(`(?<![\\w-])(?:${COLOR_UTILITY})-(?:(?:${DEFAULT_PALETTE})-\\d{2,3}|black)\\b`, 'g');
// 文字列の中の16進の色（'#fff' / "#FFFFFF" / bg-[#123456]）。コメントの「Issue #107」は拾わない
const HEX_COLOR = /(?<=['"`[])#(?:[0-9a-fA-F]{3}){1,2}(?:[0-9a-fA-F]{2})?\b/g;

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

function sourceFiles(dir: string): string[] {
  return readdirSync(path.join(REPO_ROOT, dir), { recursive: true, encoding: 'utf-8' })
    .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f) && !f.endsWith('.d.ts'))
    .map((f) => path.join(dir, f));
}

function violations(pattern: RegExp): string[] {
  return SCAN_DIRS.flatMap(sourceFiles).flatMap((file) =>
    readFileSync(path.join(REPO_ROOT, file), 'utf-8')
      .split('\n')
      .flatMap((text, i) => {
        if (ALLOWED.some((a) => a.file === file && a.line.test(text))) return [];
        return [...text.matchAll(pattern)].map((m) => `${file}:${i + 1} ${m[0]}`);
      }),
  );
}

describe('既定の色を使っていない', () => {
  it('Tailwind の既定の色クラスが無い', () => {
    expect(violations(DEFAULT_COLOR_CLASS)).toEqual([]);
  });

  it('トークンを通さない16進の色が無い（路線色など DB から来る色は除く）', () => {
    expect(violations(HEX_COLOR)).toEqual([]);
  });

  it('走査の対象のファイルがある（パスの誤りで空振りしない）', () => {
    expect(sourceFiles('apps/web/src').length).toBeGreaterThan(10);
    expect(sourceFiles('packages/platform-diagram/src').length).toBeGreaterThan(5);
  });
});
