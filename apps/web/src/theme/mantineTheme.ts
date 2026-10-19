import { createTheme, SegmentedControl, type MantineColorsTuple } from '@mantine/core';

// ブランド色の10段階（index 0〜9 = globals.css の --brand-50〜--brand-900）。
// Mantine の theme.colors は CSS 変数を受け付けないため、値を複製している（ADR-0017 決定5）。
// 正は globals.css。変えるときは両方を直す（mantineTheme.test.ts が一致を確かめる）。
export const BRAND_COLORS: MantineColorsTuple = [
  '#FDF3F6',
  '#FAE3EB',
  '#F5C5D6',
  '#EE9FBA',
  '#E6789E',
  '#DF5286',
  '#C63D71',
  '#A02F5B',
  '#6E2140',
  '#4A1630',
];

export const mantineTheme = createTheme({
  colors: { brand: BRAND_COLORS },
  primaryColor: 'brand',
  // 白い文字を載せる面は 600（500 と白は 3.69:1 で本文の基準に届かない）
  primaryShade: 6,
  // --mantine-color-text の元。既定の #000 のままだと Mantine 部品だけ純黒になる（ADR-0017 決定2）。
  // 値は globals.css の --neutral-900 の複製（mantineTheme.test.ts が一致を確かめる）
  black: '#2A2326',
  fontFamily: 'var(--font-sans)',
  headings: { fontFamily: 'var(--font-display)' },
  // lg = 16px（入力欄の角丸。ADR-0017 決定4）
  defaultRadius: 'lg',
  components: {
    // 角丸のセグメント（選択中は白地・太字・影）。SearchTabs と乗換の移動手段の切り替えで同じ見た目にする。
    // 選択中の文字色だけは呼び出し側が classNames.label で足す（Mantine は theme と props の classNames を合成する）。
    // Mantine の CSS は @layer mantine にあり、utilities が勝つ（layers.css）
    SegmentedControl: SegmentedControl.extend({
      classNames: {
        root: 'p-1 rounded-full bg-subtle',
        indicator: 'rounded-full bg-surface shadow-raised',
        label: 'flex items-center justify-center h-11 py-0 rounded-full text-sm font-medium text-ink-soft hover:text-ink data-[active]:font-bold',
      },
    }),
  },
});
