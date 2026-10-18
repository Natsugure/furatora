import { Container } from './Container';

// 画面の本文エリア。上部の背景（bg-canvas）の下に、上端を丸めた白い面を画面の下端まで敷く（REQ-5）。
// 下端まで伸ばすため、layout.tsx の <main> は flex の縦並びにしてある
export function Sheet({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <section className="flex-1 bg-surface rounded-t-sheet shadow-sheet">
      <Container className={`pt-7 pb-8 ${className ?? ''}`}>{children}</Container>
    </section>
  );
}
