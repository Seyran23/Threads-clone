'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Bookmark,
  Check,
  Flag,
  Heart,
  Link as LinkIcon,
  MessageCircle,
  MoreHorizontal,
  Repeat2,
  Send,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import type { Post } from '@threads-clone/shared-types';

import { Avatar, AvatarBadge, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { followUser, unfollowUser } from '@/lib/api/follows';
import { likePost, savePost, unlikePost, unsavePost } from '@/lib/api/posts';
import { useCurrentUser } from '@/lib/hooks/use-current-user';
import { usePresence } from '@/lib/hooks/use-presence';
import { cn } from '@/lib/utils';
import {
  removePostFromSavedPostsCache,
  updateAuthorFollowInCaches,
  updatePostInCaches,
} from '@/lib/utils/optimistic-post-update';
import { formatRelativeTime } from '@/lib/utils/relative-time';

import { ReportPostDialog } from './report-post-dialog';

interface PostCardProps {
  post: Post;
  compact?: boolean;
  threadLine?: 'start' | 'middle' | 'end';
}

export function PostCard({ post, compact = false, threadLine }: PostCardProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const isOwnPost = currentUser?.user.id === post.author.id;
  const isAuthorOnline = usePresence(post.author.id);
  const [copied, setCopied] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);

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

  const saveMutation = useMutation({
    mutationFn: () => (post.isSaved ? unsavePost(post.id) : savePost(post.id)),
    onMutate: () => {
      const previous = post.isSaved;
      updatePostInCaches(queryClient, post.id, (p) => ({ ...p, isSaved: !p.isSaved }));
      if (previous) {
        removePostFromSavedPostsCache(queryClient, post.id);
      }
      return previous;
    },
    onError: (_error, _vars, previous) => {
      if (previous === undefined) {
        return;
      }
      updatePostInCaches(queryClient, post.id, (p) => ({ ...p, isSaved: previous }));
    },
  });

  const copyLink = async () => {
    await navigator.clipboard.writeText(`${window.location.origin}/post/${post.id}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <motion.div
      role="link"
      tabIndex={0}
      onClick={() => router.push(`/post/${post.id}`)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          router.push(`/post/${post.id}`);
        }
      }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={cn(
        'flex cursor-pointer gap-3 border-b border-border hover:bg-muted/40',
        compact ? 'px-4 py-2.5' : 'p-4',
      )}
    >
      <Link
        href={`/profile/${post.author.username}`}
        onClick={(e) => e.stopPropagation()}
        className="relative block self-stretch"
      >
        {threadLine && (
          <div
            aria-hidden="true"
            className={cn(
              'absolute left-1/2 w-0.5 -translate-x-1/2 bg-muted-foreground/30',
              threadLine === 'start' && (compact ? 'top-8 bottom-0' : 'top-10 bottom-0'),
              threadLine === 'middle' && 'top-0 bottom-0',
              threadLine === 'end' && (compact ? 'top-0 h-8' : 'top-0 h-10'),
            )}
          />
        )}
        <Avatar size={compact ? 'default' : 'lg'} className="relative">
          {post.author.avatarUrl && (
            <AvatarImage src={post.author.avatarUrl} alt={`${post.author.username}'s avatar`} />
          )}
          <AvatarFallback>{post.author.username.slice(0, 1).toUpperCase()}</AvatarFallback>
          {isAuthorOnline && <AvatarBadge className="bg-green-500" aria-label="Online" />}
        </Avatar>
      </Link>

      <div className="min-w-0 flex-1 space-y-1.5">
        <div className={cn('flex items-center gap-1.5', compact ? 'text-sm' : 'text-[15px]')}>
          <Link
            href={`/profile/${post.author.username}`}
            onClick={(e) => e.stopPropagation()}
            className="font-semibold hover:underline"
          >
            {post.author.username}
          </Link>
          <span className="text-muted-foreground">· {formatRelativeTime(post.createdAt)}</span>

          <div className="ml-auto flex items-center gap-3">
            {!isOwnPost && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  followMutation.mutate();
                }}
                className={cn(
                  '-m-1 p-1 text-sm font-medium',
                  post.isFollowing ? 'text-muted-foreground' : 'text-primary',
                )}
              >
                {post.isFollowing ? 'Following' : 'Follow'}
              </button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger
                onClick={(e) => e.stopPropagation()}
                className="-m-1 p-1 text-muted-foreground hover:text-foreground"
                aria-label="More options"
              >
                <MoreHorizontal className="size-5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem onClick={() => saveMutation.mutate()}>
                  <Bookmark className={cn('size-4', post.isSaved && 'fill-current')} />
                  {post.isSaved ? 'Unsave' : 'Save'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void copyLink()}>
                  {copied ? <Check className="size-4" /> : <LinkIcon className="size-4" />}
                  {copied ? 'Copied!' : 'Copy link'}
                </DropdownMenuItem>
                {!isOwnPost && (
                  <DropdownMenuItem variant="destructive" onClick={() => setReportDialogOpen(true)}>
                    <Flag className="size-4" />
                    Report
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <p
          className={cn(
            'whitespace-pre-wrap break-words leading-normal',
            compact ? 'text-sm' : 'text-[15px]',
          )}
        >
          {post.content}
        </p>

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

        <div
          className={cn(
            'flex items-center gap-5 text-muted-foreground',
            compact ? 'pt-1' : 'pt-1.5',
          )}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              likeMutation.mutate();
            }}
            className={cn(
              '-m-1 flex items-center gap-1.5 p-1 text-sm transition-colors hover:text-foreground',
              post.isLiked && 'text-destructive hover:text-destructive',
            )}
            aria-label={
              post.isLiked
                ? `Unlike${post.likeCount > 0 ? `, ${post.likeCount} likes` : ''}`
                : `Like${post.likeCount > 0 ? `, ${post.likeCount} likes` : ''}`
            }
          >
            <motion.span
              animate={post.isLiked ? { scale: [1, 1.3, 1] } : { scale: 1 }}
              transition={{ duration: 0.3 }}
              className="inline-flex"
            >
              <Heart
                className={cn(compact ? 'size-5' : 'size-5.5', post.isLiked && 'fill-current')}
              />
            </motion.span>
            {post.likeCount > 0 && <span aria-hidden="true">{post.likeCount}</span>}
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/post/${post.id}`);
            }}
            className="-m-1 flex items-center gap-1.5 p-1 text-sm transition-colors hover:text-foreground"
            aria-label={`Reply${post.replyCount > 0 ? `, ${post.replyCount} replies` : ''}`}
          >
            <MessageCircle className={compact ? 'size-5' : 'size-5.5'} />
            {post.replyCount > 0 && <span aria-hidden="true">{post.replyCount}</span>}
          </button>

          <span className="flex items-center gap-1.5 text-sm opacity-40" aria-hidden="true">
            <Repeat2 className={compact ? 'size-5' : 'size-5.5'} />
          </span>
          <span className="flex items-center gap-1.5 text-sm opacity-40" aria-hidden="true">
            <Send className={compact ? 'size-5' : 'size-5.5'} />
          </span>
        </div>
      </div>

      <ReportPostDialog
        postId={post.id}
        open={reportDialogOpen}
        onOpenChange={setReportDialogOpen}
      />
    </motion.div>
  );
}
