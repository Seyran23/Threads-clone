import { Skeleton } from '@/components/ui/skeleton';

export function RowSkeleton() {
  return (
    <div className="flex items-center gap-3 border-b border-border p-4">
      <Skeleton className="size-10 shrink-0 rounded-full" />
      <Skeleton className="h-3.5 flex-1" />
    </div>
  );
}

export function RowSkeletonList({ count = 4 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <RowSkeleton key={i} />
      ))}
    </>
  );
}
