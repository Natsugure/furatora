import { Container } from '@/components/ui/Container';
import { Sheet } from '@/components/ui/Sheet';

// 駅の詳細（page.tsx）と同じ構成の骨組み: 上部に戻るボタンと駅の見出し、本文エリアに乗換とホーム
export default function StationDetailLoading() {
  return (
    <div aria-busy className="flex-1 flex flex-col animate-pulse">
      <Container className="pt-2 pb-6">
        <div className="size-11 rounded-full bg-surface mb-5" />
        <div className="flex items-center gap-4">
          <div className="size-13.5 rounded-full bg-subtle flex-shrink-0" />
          <div className="space-y-2">
            <div className="h-9 bg-subtle rounded-full w-32" />
            <div className="h-3.5 bg-subtle rounded-full w-24" />
          </div>
        </div>
        <div className="flex gap-1.5 mt-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-7.5 w-24 rounded-full bg-surface" />
          ))}
        </div>
      </Container>

      <Sheet className="flex flex-col gap-5">
        <div className="h-5 bg-subtle rounded-full w-56" />
        <div className="h-13.5 bg-subtle rounded-input" />
        <div className="h-13 bg-subtle rounded-full" />
        <div className="h-40 bg-subtle rounded-card" />
        <div className="h-5 bg-subtle rounded-full w-16" />
        <div className="h-48 bg-subtle rounded-card" />
      </Sheet>
    </div>
  );
}
