import { Container } from '@/components/ui/Container';
import { Sheet } from '@/components/ui/Sheet';

// 路線の駅一覧（page.tsx）と同じ構成の骨組み: 上部に戻るボタンと路線の見出し、本文エリアに駅のタイムライン
export default function StationListLoading() {
  return (
    <div aria-busy className="flex-1 flex flex-col animate-pulse">
      <Container className="pt-2 pb-6">
        <div className="size-11 rounded-full bg-surface mb-5" />
        <div className="flex items-center gap-4">
          <div className="size-15 rounded-full bg-subtle flex-shrink-0" />
          <div className="space-y-2">
            <div className="h-8 bg-subtle rounded-full w-40" />
            <div className="h-3.5 bg-subtle rounded-full w-32" />
          </div>
        </div>
      </Container>

      <Sheet>
        <div className="h-4 bg-subtle rounded-full w-24 mb-3" />
        {[...Array(8)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 min-h-23 py-2">
            <div className="size-13.5 rounded-full bg-subtle flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-5 bg-subtle rounded-full w-28" />
              <div className="h-3 bg-subtle rounded-full w-20" />
            </div>
            <div className="size-7.5 rounded-full bg-subtle flex-shrink-0" />
          </div>
        ))}
      </Sheet>
    </div>
  );
}
