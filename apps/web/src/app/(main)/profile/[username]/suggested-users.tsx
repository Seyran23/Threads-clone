'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';

import type { GraphUser } from '@threads-clone/shared-types';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { followUser } from '@/lib/api/follows';
import { getSuggestedUsers } from '@/lib/api/graph';
import { queryKeys } from '@/lib/query-keys';

function SuggestedUserCard({ user }: { user: GraphUser }) {
  const [isFollowing, setIsFollowing] = useState(false);
  const followMutation = useMutation({
    mutationFn: () => followUser(user.id),
    onSuccess: () => setIsFollowing(true),
  });

  return (
    <div className="flex w-32 shrink-0 flex-col items-center gap-2 rounded-xl border border-border p-3">
      <Link href={`/profile/${user.username}`}>
        <Avatar size="lg">
          <AvatarFallback>{user.username.slice(0, 1).toUpperCase()}</AvatarFallback>
        </Avatar>
      </Link>
      <Link
        href={`/profile/${user.username}`}
        className="max-w-full truncate text-sm font-semibold hover:underline"
      >
        {user.username}
      </Link>
      <Button
        size="sm"
        variant={isFollowing ? 'outline' : 'default'}
        className="w-full"
        disabled={isFollowing || followMutation.isPending}
        onClick={() => followMutation.mutate()}
      >
        {isFollowing ? 'Following' : 'Follow'}
      </Button>
    </div>
  );
}

interface SuggestedUsersProps {
  userId: string;
}

export function SuggestedUsers({ userId }: SuggestedUsersProps) {
  const { data } = useQuery({
    queryKey: queryKeys.suggestedUsers(userId),
    queryFn: () => getSuggestedUsers(userId),
  });

  if (!data || data.length === 0) {
    return null;
  }

  return (
    <div className="border-b border-border p-4">
      <p className="mb-3 text-sm font-semibold">Suggested for you</p>
      <div className="flex gap-3 overflow-x-auto">
        {data.map((user) => (
          <SuggestedUserCard key={user.id} user={user} />
        ))}
      </div>
    </div>
  );
}
