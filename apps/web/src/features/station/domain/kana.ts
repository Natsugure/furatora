export function toKatakana(s: string): string {
  return s.normalize('NFKC').replace(/[\u3041-\u3096]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
}