'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, SearchIcon } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { RowSkeletonList } from '@/components/ui/row-skeleton';
import { search } from '@/lib/api/search';
import { queryKeys } from '@/lib/query-keys';
import { formatRelativeTime } from '@/lib/utils/relative-time';

export default function SearchPage() {
  const [input, setInput] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedQuery(input.trim()), 300);
    return () => clearTimeout(timeout);
  }, [input]);

  const searchQuery = useQuery({
    queryKey: queryKeys.search(debouncedQuery),
    queryFn: () => search(debouncedQuery),
    enabled: debouncedQuery.length > 0,
  });

  const hasResults =
    searchQuery.data && (searchQuery.data.posts.length > 0 || searchQuery.data.users.length > 0);

  return (
    <div className="mx-auto w-full max-w-xl">
      <div className="flex items-center gap-3 border-b border-border p-4">
        <Link href="/" aria-label="Back to feed">
          <ArrowLeft className="size-5" />
        </Link>
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            placeholder="Search"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {debouncedQuery.length === 0 && (
        <p className="p-8 text-center text-sm text-muted-foreground">Search for posts or people.</p>
      )}

      {searchQuery.isLoading && <RowSkeletonList />}
      {searchQuery.isError && (
        <p className="p-4 text-sm text-destructive">Something went wrong. Try again.</p>
      )}
      {searchQuery.data && !hasResults && debouncedQuery.length > 0 && (
        <p className="p-8 text-center text-sm text-muted-foreground">
          No results for &quot;{debouncedQuery}&quot;.
        </p>
      )}

      {searchQuery.data && searchQuery.data.users.length > 0 && (
        <div>
          <p className="px-4 pt-4 text-xs font-semibold text-muted-foreground uppercase">People</p>
          {searchQuery.data.users.map((user) => (
            <Link
              key={user.id}
              href={`/profile/${user.username}`}
              className="flex items-center gap-3 border-b border-border p-4 hover:bg-muted/40"
            >
              <Avatar size="lg">
                {user.avatarUrl && (
                  <AvatarImage src={user.avatarUrl} alt={`${user.username}'s avatar`} />
                )}
                <AvatarFallback>{user.username.slice(0, 1).toUpperCase()}</AvatarFallback>
              </Avatar>
              <span className="font-semibold">{user.username}</span>
            </Link>
          ))}
        </div>
      )}

      {searchQuery.data && searchQuery.data.posts.length > 0 && (
        <div>
          <p className="px-4 pt-4 text-xs font-semibold text-muted-foreground uppercase">Posts</p>
          {searchQuery.data.posts.map((post) => (
            <Link
              key={post.id}
              href={`/post/${post.id}`}
              className="block border-b border-border p-4 hover:bg-muted/40"
            >
              <div className="flex items-center gap-1.5 text-[15px]">
                <span className="font-semibold">{post.authorUsername}</span>
                <span className="text-muted-foreground">
                  · {formatRelativeTime(post.createdAt)}
                </span>
              </div>
              <p className="mt-1 line-clamp-3 whitespace-pre-wrap break-words text-[15px] text-muted-foreground">
                {post.content}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
