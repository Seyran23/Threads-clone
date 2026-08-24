'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

import type { BlockedUser } from '@threads-clone/shared-types';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { RowSkeletonList } from '@/components/ui/row-skeleton';
import { getBlockedUsers, unblockUser } from '@/lib/api/blocks';
import { queryKeys } from '@/lib/query-keys';

function BlockedUserRow({ user }: { user: BlockedUser }) {
  const queryClient = useQueryClient();

  const unblockMutation = useMutation({
    mutationFn: () => unblockUser(user.id),
    onMutate: () => {
      queryClient.setQueryData<BlockedUser[]>(queryKeys.blockedUsers, (data) =>
        data?.filter((u) => u.id !== user.id),
      );
    },
  });

  return (
    <div className="flex items-center gap-3 border-b border-border p-4">
      <Avatar>
        {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={`${user.username}'s avatar`} />}
        <AvatarFallback>{user.username.slice(0, 1).toUpperCase()}</AvatarFallback>
      </Avatar>
      <p className="min-w-0 flex-1 truncate text-[15px] font-semibold">{user.username}</p>
      <Button
        variant="outline"
        size="sm"
        onClick={() => unblockMutation.mutate()}
        disabled={unblockMutation.isPending}
      >
        Unblock
      </Button>
    </div>
  );
}

export default function BlockedAccountsPage() {
  const blockedQuery = useQuery({
    queryKey: queryKeys.blockedUsers,
    queryFn: getBlockedUsers,
  });

  return (
    <div className="mx-auto w-full max-w-xl">
      <div className="flex items-center gap-3 border-b border-border p-4">
        <Link href="/" aria-label="Back to feed">
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-base font-semibold">Blocked accounts</h1>
      </div>

      {blockedQuery.isLoading && <RowSkeletonList />}
      {blockedQuery.isError && (
        <p className="p-4 text-sm text-destructive">Couldn&apos;t load blocked accounts.</p>
      )}
      {blockedQuery.data && blockedQuery.data.length === 0 && (
        <p className="p-8 text-center text-sm text-muted-foreground">
          You haven&apos;t blocked anyone.
        </p>
      )}
      {blockedQuery.data?.map((user) => (
        <BlockedUserRow key={user.id} user={user} />
      ))}
    </div>
  );
}
