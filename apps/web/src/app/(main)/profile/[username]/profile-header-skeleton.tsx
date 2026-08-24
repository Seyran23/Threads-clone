import { Skeleton } from '@/components/ui/skeleton';

export function ProfileHeaderSkeleton() {
  return (
    <div className="space-y-4 border-b border-border p-4">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="size-10 rounded-full" />
      </div>
      <Skeleton className="h-4 w-40" />
      <div className="flex gap-2">
        <Skeleton className="h-9 flex-1 rounded-lg" />
        <Skeleton className="h-9 w-9 rounded-lg" />
      </div>
    </div>
  );
}
