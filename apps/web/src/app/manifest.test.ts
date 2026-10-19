import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const MANIFEST = path.resolve(__dirname, './manifest.json');
const PUBLIC_DIR = path.resolve(__dirname, '../../public');

interface ManifestIcon {
  src: string;
  purpose?: string;
}

interface Manifest {
  id?: string;
  name: string;
  short_name: string;
  start_url?: string;
  scope?: string;
  icons: ManifestIcon[];
}

const manifest = JSON.parse(readFileSync(MANIFEST, 'utf-8')) as Manifest;

describe('manifest.json', () => {
  it('name と short_name が空でない', () => {
    expect(manifest.name).not.toBe('');
    expect(manifest.short_name).not.toBe('');
  });

  // 無いと、ホーム画面に追加した時のページから毎回起動する。id は後から変えると別のアプリになる
  it('id・start_url・scope がトップページ', () => {
    expect(manifest.id).toBe('/');
    expect(manifest.start_url).toBe('/');
    expect(manifest.scope).toBe('/');
  });

  it.each(manifest.icons.map((icon) => icon.src))('%s が public/ にある', (src) => {
    expect(existsSync(path.join(PUBLIC_DIR, src))).toBe(true);
  });

  // 文字（ふらっと）が maskable の安全領域からはみ出すため、OS に切り抜かせない（ADR-0019）
  it('アイコンを maskable にしない', () => {
    for (const icon of manifest.icons) {
      expect(icon.purpose ?? 'any').not.toContain('maskable');
    }
  });
});
