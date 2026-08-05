'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { logoutUser } from '@/lib/api/auth';
import { useCurrentUser } from '@/lib/hooks/use-current-user';

export default function HomePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data, isPending, isError } = useCurrentUser();

  useEffect(() => {
    if (isError) {
      router.replace('/login');
    }
  }, [isError, router]);

  if (isPending || isError) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground text-sm">Loading…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <p className="text-lg">
        Welcome, <span className="font-semibold">{data.user.username}</span>
      </p>
      <Button
        variant="outline"
        onClick={async () => {
          await logoutUser();
          queryClient.clear();
          router.push('/login');
        }}
      >
        Log out
      </Button>
    </div>
  );
}
