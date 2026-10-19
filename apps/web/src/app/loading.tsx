import { Container } from '@/components/ui/Container';
import { Sheet } from '@/components/ui/Sheet';

// トップ（page.tsx）と同じ構成の骨組み: 上部に見出しと検索、本文エリアにできることの一覧と事業者
export default function HomeLoading() {
  return (
    <div aria-busy className="flex-1 flex flex-col animate-pulse">
      <Container className="pt-4 pb-6 flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <div className="h-3.5 bg-subtle rounded-full w-56" />
          <div className="h-9 bg-subtle rounded-full w-40" />
          <div className="h-9 bg-subtle rounded-full w-52" />
        </div>
        <div className="h-13 bg-subtle rounded-full" />
        <div className="h-14.5 bg-surface rounded-input shadow-card" />
      </Container>

      <Sheet className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <div className="h-5 bg-subtle rounded-full w-44" />
          <div className="h-3.5 bg-subtle rounded-full w-full" />
        </div>
        <div className="flex flex-col">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 py-2.5">
              <div className="size-13 rounded-full bg-subtle flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-subtle rounded-full w-3/4" />
                <div className="h-3 bg-subtle rounded-full w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </Sheet>
    </div>
  );
}
