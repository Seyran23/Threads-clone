'use client';

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Link as LinkIcon, MoreHorizontal, UserX } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { PostCard } from '@/components/posts/post-card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { blockUser } from '@/lib/api/blocks';
import { followUser, unfollowUser } from '@/lib/api/follows';
import { getUserPosts, getUserProfile } from '@/lib/api/users';
import { useCurrentUser } from '@/lib/hooks/use-current-user';
import { useInfiniteScrollSentinel } from '@/lib/hooks/use-infinite-scroll-sentinel';
import { queryKeys } from '@/lib/query-keys';
import { updateAuthorFollowInCaches } from '@/lib/utils/optimistic-post-update';

import { EditProfileDialog } from './edit-profile-dialog';
import { SuggestedUsers } from './suggested-users';

interface ProfileViewProps {
  username: string;
}

export function ProfileView({ username }: ProfileViewProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const [copied, setCopied] = useState(false);
  const isOwnProfile = currentUser?.user.username === username;

  const profileQuery = useQuery({
    queryKey: queryKeys.profile(username),
    queryFn: () => getUserProfile(username),
  });

  const postsQuery = useInfiniteQuery({
    queryKey: queryKeys.userPosts(username),
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      getUserPosts(username, { cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: profileQuery.isSuccess,
  });

  const sentinelRef = useInfiniteScrollSentinel({
    onIntersect: () => {
      if (postsQuery.hasNextPage && !postsQuery.isFetchingNextPage) {
        void postsQuery.fetchNextPage();
      }
    },
    enabled: !!postsQuery.hasNextPage,
  });

  const followMutation = useMutation({
    mutationFn: () => {
      const profile = profileQuery.data;
      if (!profile) {
        throw new Error('Profile not loaded');
      }
      return profile.isFollowing ? unfollowUser(profile.id) : followUser(profile.id);
    },
    onMutate: () => {
      const profile = profileQuery.data;
      if (!profile) {
        return undefined;
      }
      const previous = profile.isFollowing;
      queryClient.setQueryData(queryKeys.profile(username), {
        ...profile,
        isFollowing: !previous,
        followerCount: profile.followerCount + (previous ? -1 : 1),
      });
      updateAuthorFollowInCaches(queryClient, profile.id, !previous);
      return previous;
    },
    onError: (_error, _vars, previous) => {
      const profile = profileQuery.data;
      if (previous === undefined || !profile) {
        return;
      }
      queryClient.setQueryData(queryKeys.profile(username), {
        ...profile,
        isFollowing: previous,
      });
      updateAuthorFollowInCaches(queryClient, profile.id, previous);
    },
    onSuccess: (result) => {
      const profile = profileQuery.data;
      if (!profile) {
        return;
      }
      queryClient.setQueryData(queryKeys.profile(username), {
        ...profile,
        isFollowing: result.following,
      });
      updateAuthorFollowInCaches(queryClient, profile.id, result.following);
    },
  });

  const blockMutation = useMutation({
    mutationFn: () => {
      const profile = profileQuery.data;
      if (!profile) {
        throw new Error('Profile not loaded');
      }
      return blockUser(profile.id);
    },
    onSuccess: () => {
      router.push('/');
    },
  });

  const copyProfileLink = async () => {
    await navigator.clipboard.writeText(`${window.location.origin}/profile/${username}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const posts = postsQuery.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="mx-auto w-full max-w-xl pb-10">
      <div className="flex items-center gap-3 border-b border-border p-4">
        <Link href="/" aria-label="Back to feed">
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-base font-semibold">{username}</h1>
      </div>

      {profileQuery.isLoading && <p className="p-4 text-sm text-muted-foreground">Loading…</p>}
      {profileQuery.isError && (
        <p className="p-4 text-sm text-destructive">Couldn&apos;t find this profile.</p>
      )}

      {profileQuery.data && (
        <div className="space-y-4 border-b border-border p-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold">{profileQuery.data.username}</h2>
              <p className="text-sm text-muted-foreground">@{profileQuery.data.username}</p>
            </div>
            <Avatar size="lg">
              {profileQuery.data.avatarUrl && (
                <AvatarImage
                  src={profileQuery.data.avatarUrl}
                  alt={`${profileQuery.data.username}'s avatar`}
                />
              )}
              <AvatarFallback className="text-lg">
                {profileQuery.data.username.slice(0, 1).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>

          <p className="text-sm text-muted-foreground">
            {profileQuery.data.followerCount} followers · {profileQuery.data.followingCount}{' '}
            following
          </p>

          <div className="flex gap-2">
            {isOwnProfile ? (
              <>
                <EditProfileDialog
                  username={profileQuery.data.username}
                  avatarUrl={profileQuery.data.avatarUrl}
                />
                <Button variant="outline" className="flex-1" onClick={() => void copyProfileLink()}>
                  {copied ? 'Copied!' : 'Share profile'}
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant={profileQuery.data.isFollowing ? 'outline' : 'default'}
                  className="flex-1"
                  onClick={() => followMutation.mutate()}
                >
                  {profileQuery.data.isFollowing ? 'Following' : 'Follow'}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className="inline-flex size-9 items-center justify-center rounded-full border border-input hover:bg-accent"
                    aria-label="More options"
                  >
                    <MoreHorizontal className="size-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => void copyProfileLink()}>
                      <LinkIcon className="size-4" />
                      {copied ? 'Copied!' : 'Copy profile link'}
                    </DropdownMenuItem>
                    <DropdownMenuItem variant="destructive" onClick={() => blockMutation.mutate()}>
                      <UserX className="size-4" />
                      Block
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        </div>
      )}

      {isOwnProfile && profileQuery.data && <SuggestedUsers userId={profileQuery.data.id} />}

      {postsQuery.isLoading && <p className="p-4 text-sm text-muted-foreground">Loading posts…</p>}
      {postsQuery.isError && (
        <p className="p-4 text-sm text-destructive">Couldn&apos;t load posts.</p>
      )}
      {postsQuery.data && posts.length === 0 && (
        <p className="p-8 text-center text-sm text-muted-foreground">No threads yet.</p>
      )}
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}

      <div ref={sentinelRef} className="h-1" />
      {postsQuery.isFetchingNextPage && (
        <p className="p-4 text-center text-sm text-muted-foreground">Loading more…</p>
      )}
    </div>
  );
}
