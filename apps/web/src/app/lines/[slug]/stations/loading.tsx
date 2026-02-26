import { Container } from '@/components/ui/Container';

export default function StationListLoading() {
  return (
    <Container className="py-6 animate-pulse">
      {/* Back button skeleton */}
      <div className="h-8 bg-gray-200 rounded-lg w-36 mb-5" />

      {/* Line header card skeleton */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-1.5 h-12 rounded-full bg-gray-200 flex-shrink-0" />
          <div className="space-y-2">
            <div className="h-7 bg-gray-200 rounded w-48" />
            <div className="h-4 bg-gray-200 rounded w-32" />
            <div className="h-3 bg-gray-200 rounded w-16" />
          </div>
        </div>
      </div>

      {/* Section label skeleton */}
      <div className="h-3 bg-gray-200 rounded w-16 mb-3" />

      {/* Station cards skeleton */}
      <div className="space-y-2">
        {[...Array(10)].map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3 flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-lg bg-gray-200 flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 bg-gray-200 rounded w-24" />
              <div className="h-3 bg-gray-200 rounded w-16" />
            </div>
            <div className="w-4 h-4 bg-gray-200 rounded flex-shrink-0" />
          </div>
        ))}
      </div>
    </Container>
  );
}
