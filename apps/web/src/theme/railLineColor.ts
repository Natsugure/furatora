// 線・輪に塗る路線色。路線色は DB から来て、null や空文字のこともある。
// そのときはニュートラルの色（globals.css の --color-rail-line-fallback）にする
export function railLineColor(color: string | null | undefined): string {
  return color || 'var(--color-rail-line-fallback)';
}
