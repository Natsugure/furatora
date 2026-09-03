import type { Decimal6 } from './importedRecords';

/**
 * lat / lon は decimal(9,6) に入る。CSV は桁数が揃っておらず
 * （`139.74044` と `139.766084` が混在する）、DB から読み戻すと必ず小数6桁になる。
 * 比較の前に同じ形へ揃えないと、値が同じでも毎回「更新あり」と判定され、
 * 冪等性（REQ-1.5）が成立しない。
 */
export function toDecimal6(value: string | null | undefined): Decimal6 | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return null;
  return n.toFixed(6);
}

/**
 * 路線色は `#RRGGBB` の大文字で持つ。ekidata は `#` の無い6桁16進で配布し、
 * 現行DB（ODPT 由来）は `#F62E36` の形で持っているため、両者を同じ形へ寄せる。
 */
export function toHexColor(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const body = value.trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(body)) return null;
  return `#${body.toUpperCase()}`;
}

/** 空文字を null として扱う。「空値では上書きしない」規則の入口 */
export function emptyToNull(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * ekidata の日付は未設定を `0000-00-00` で表す。date 列に入れられないため null にする。
 */
export function toDateOrNull(value: string | null | undefined): string | null {
  const v = emptyToNull(value);
  if (v === null) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  if (v.startsWith('0000')) return null;
  return v;
}
