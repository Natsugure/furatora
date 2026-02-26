import { Container } from '@/components/ui/Container';

export default function StationDetailLoading() {
  return (
    <Container className="py-6 animate-pulse">
      {/* Back button skeleton */}
      <div className="h-8 bg-gray-200 rounded-lg w-40 mb-5" />

      {/* Station header card skeleton */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-5">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-gray-200 flex-shrink-0" />
          <div className="space-y-2">
            <div className="h-7 bg-gray-200 rounded w-40" />
            <div className="h-4 bg-gray-200 rounded w-24" />
          </div>
        </div>
      </div>

      {/* Info alert skeleton */}
      <div className="mb-5 bg-gray-50 border border-gray-200 rounded-xl p-4">
        <div className="flex gap-2.5">
          <div className="w-4 h-4 rounded bg-gray-200 flex-shrink-0 mt-0.5" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-24" />
            <div className="h-3 bg-gray-200 rounded w-full" />
            <div className="h-3 bg-gray-200 rounded w-5/6" />
          </div>
        </div>
      </div>

      {/* Section label skeleton */}
      <div className="h-3 bg-gray-200 rounded w-20 mb-3" />

      {/* Platform card skeleton */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
        {/* Platform header */}
        <div className="flex items-center gap-3">
          <div className="h-5 bg-gray-200 rounded w-24" />
          <div className="h-5 bg-gray-200 rounded w-16" />
        </div>

        {/* Train diagram skeleton */}
        <div className="space-y-2">
          <div className="h-4 bg-gray-200 rounded w-32" />
          <div className="flex gap-1">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex-1 h-16 bg-gray-200 rounded" />
            ))}
          </div>
          <div className="flex gap-1">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex-1 h-4 bg-gray-100 rounded" />
            ))}
          </div>
        </div>

        {/* Facility row skeleton */}
        <div className="space-y-2 pt-2 border-t border-gray-100">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-gray-200 flex-shrink-0" />
              <div className="h-3 bg-gray-200 rounded w-48" />
            </div>
          ))}
        </div>
      </div>
    </Container>
  );
}
