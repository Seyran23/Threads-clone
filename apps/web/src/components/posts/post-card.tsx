'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Heart, MessageCircle } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

import type { Post } from '@threads-clone/shared-types';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { followUser, unfollowUser } from '@/lib/api/follows';
import { likePost, unlikePost } from '@/lib/api/posts';
import { useCurrentUser } from '@/lib/hooks/use-current-user';
import { cn } from '@/lib/utils';
import { updateAuthorFollowInCaches, updatePostInCaches } from '@/lib/utils/optimistic-post-update';
import { formatRelativeTime } from '@/lib/utils/relative-time';

interface PostCardProps {
  post: Post;
}

export function PostCard({ post }: PostCardProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const isOwnPost = currentUser?.user.id === post.author.id;

  const likeMutation = useMutation({
    mutationFn: () => (post.isLiked ? unlikePost(post.id) : likePost(post.id)),
    onMutate: () => {
      const previous = { isLiked: post.isLiked, likeCount: post.likeCount };
      updatePostInCaches(queryClient, post.id, (p) => ({
        ...p,
        isLiked: !p.isLiked,
        likeCount: p.likeCount + (p.isLiked ? -1 : 1),
      }));
      return previous;
    },
    onError: (_error, _vars, previous) => {
      if (!previous) {
        return;
      }
      updatePostInCaches(queryClient, post.id, (p) => ({ ...p, ...previous }));
    },
    onSuccess: (result) => {
      updatePostInCaches(queryClient, post.id, (p) => ({
        ...p,
        isLiked: result.liked,
        likeCount: result.likeCount,
      }));
    },
  });

  const followMutation = useMutation({
    mutationFn: () =>
      post.isFollowing ? unfollowUser(post.author.id) : followUser(post.author.id),
    onMutate: () => {
      const previous = post.isFollowing;
      updateAuthorFollowInCaches(queryClient, post.author.id, !previous);
      return previous;
    },
    onError: (_error, _vars, previous) => {
      if (previous === undefined) {
        return;
      }
      updateAuthorFollowInCaches(queryClient, post.author.id, previous);
    },
    onSuccess: (result) => {
      updateAuthorFollowInCaches(queryClient, post.author.id, result.following);
    },
  });

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => router.push(`/post/${post.id}`)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          router.push(`/post/${post.id}`);
        }
      }}
      className="flex cursor-pointer gap-3 border-b border-border p-4 hover:bg-muted/40"
    >
      <Avatar size="lg">
        <AvatarFallback>{post.author.username.slice(0, 1).toUpperCase()}</AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-center gap-1.5 text-[15px]">
          <span className="font-semibold">{post.author.username}</span>
          <span className="text-muted-foreground">· {formatRelativeTime(post.createdAt)}</span>
          {!isOwnPost && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                followMutation.mutate();
              }}
              className={cn(
                'ml-auto text-sm font-medium',
                post.isFollowing ? 'text-muted-foreground' : 'text-primary',
              )}
            >
              {post.isFollowing ? 'Following' : 'Follow'}
            </button>
          )}
        </div>

        <p className="whitespace-pre-wrap break-words text-[15px] leading-normal">{post.content}</p>

        {post.media.length > 0 && (
          <div
            className={cn('grid gap-2', post.media.length === 1 ? 'grid-cols-1' : 'grid-cols-2')}
          >
            {post.media.map((media) => (
              <div key={media.id} className="relative aspect-video overflow-hidden rounded-lg">
                <Image
                  src={media.thumbnailUrl ?? media.url}
                  alt=""
                  fill
                  unoptimized
                  className="object-cover"
                />
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-5 pt-1.5 text-muted-foreground">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              likeMutation.mutate();
            }}
            className={cn(
              'flex items-center gap-1.5 text-sm transition-colors hover:text-foreground',
              post.isLiked && 'text-destructive hover:text-destructive',
            )}
            aria-label={post.isLiked ? 'Unlike' : 'Like'}
          >
            <Heart className={cn('size-5.5', post.isLiked && 'fill-current')} />
            {post.likeCount > 0 && post.likeCount}
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/post/${post.id}`);
            }}
            className="flex items-center gap-1.5 text-sm transition-colors hover:text-foreground"
            aria-label="Reply"
          >
            <MessageCircle className="size-5.5" />
            {post.replyCount > 0 && post.replyCount}
          </button>
        </div>
      </div>
    </div>
  );
}
