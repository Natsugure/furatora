import { useId, type ReactNode } from 'react';
import type { DoorPosition } from '../domain/doorList';

// 図の下に出す、ドアの一覧1つぶん（例:「フリースペース 全編成」）。
// 見出しの下に、号車とドアのタイルを並べる（見本 docs/adr/assets/0017/source/Platform.dc.html）。
// admin は web の Tailwind のトークンを持たないので、色は styles.css の CSS 変数を inline style で当てる。

type Props = {
  /** 「フリースペース」「優先席」 */
  title: string;
  /** 「全編成」「一部編成」 */
  coverage: string;
  /** 見出しの頭の印（aria-hidden で描く） */
  marker: ReactNode;
  doors: DoorPosition[];
  tileBg: string;
  tileInk: string;
};

export function DoorTileList({ title, coverage, marker, doors, tileBg, tileInk }: Props) {
  const headingId = useId();
  if (doors.length === 0) return null;

  return (
    <section aria-labelledby={headingId} className="mt-4">
      <h6
        id={headingId}
        className="mb-2 flex items-center gap-2 text-base font-bold"
        style={{ color: 'var(--color-text-primary)' }}
      >
        <span aria-hidden="true" className="flex">
          {marker}
        </span>
        {title}{' '}
        <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
          {coverage}
        </span>
      </h6>
      {/* 見本は3列だが、番線のカードと列車のカードの内側に入るので、幅375pxでは1枚が約75pxになり
          「3番ドア付近」が折り返す。列の数を決めず、1枚の幅（6rem）が保てるだけ並べる */}
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(6rem,1fr))] gap-2">
        {doors.map(({ carNumber, doorNumber }) => (
          <li
            key={`${carNumber}-${doorNumber}`}
            className="flex flex-col gap-0.5 rounded-2xl px-3 py-2.5"
            style={{ backgroundColor: tileBg }}
          >
            <span className="text-[15px] font-bold" style={{ color: tileInk }}>
              {carNumber}
              <span className="text-[11px]">号車</span>
            </span>
            <span className="text-xs" style={{ color: 'var(--color-text-primary)' }}>
              {doorNumber}番ドア付近
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
