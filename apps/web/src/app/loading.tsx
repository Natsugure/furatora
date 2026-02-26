import { Container } from '@/components/ui/Container';

export default function HomeLoading() {
  return (
    <Container className="py-6">
      {/* Info card skeleton */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-6 animate-pulse">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-5 h-5 rounded bg-gray-200 flex-shrink-0 mt-0.5" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-32" />
            <div className="h-3 bg-gray-200 rounded w-full" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-gray-100 rounded-lg p-3 space-y-1.5">
              <div className="h-3 bg-gray-200 rounded w-3/4" />
              <div className="h-3 bg-gray-200 rounded w-full" />
              <div className="h-3 bg-gray-200 rounded w-5/6" />
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <div className="h-4 bg-gray-200 rounded w-24 mb-2" />
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-3 bg-gray-200 rounded w-40" />
          ))}
        </div>
      </div>

      {/* Search tabs skeleton */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm animate-pulse">
        {/* Tab headers */}
        <div className="flex border-b border-gray-200 px-4 pt-3 gap-4">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-8 bg-gray-200 rounded w-24 mb-0" />
          ))}
        </div>
        {/* Tab content */}
        <div className="p-4 space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-gray-200 flex-shrink-0" />
              <div className="h-4 bg-gray-200 rounded flex-1" />
            </div>
          ))}
        </div>
      </div>
    </Container>
  );
}
