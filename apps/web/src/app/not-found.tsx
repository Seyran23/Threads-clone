import { FileQuestion } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
      <FileQuestion className="size-10 text-muted-foreground" />
      <h1 className="text-lg font-semibold">Page not found</h1>
      <p className="max-w-xs text-sm text-muted-foreground">
        The page you&apos;re looking for doesn&apos;t exist or may have been moved.
      </p>
      <Button render={<Link href="/" />} nativeButton={false} className="mt-2">
        Go home
      </Button>
    </div>
  );
}
