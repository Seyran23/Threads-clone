import type { QueryClient } from '@tanstack/react-query';

import type { FeedPage, Post, RepliesPage } from '@threads-clone/shared-types';

type Page = FeedPage | RepliesPage;
interface InfinitePages {
  pages: Page[];
  pageParams: unknown[];
}

function isPost(data: unknown): data is Post {
  return typeof data === 'object' && data !== null && 'id' in data;
}

function isPage(data: unknown): data is Page {
  return typeof data === 'object' && data !== null && Array.isArray((data as Page).items);
}

function isInfinitePages(data: unknown): data is InfinitePages {
  return typeof data === 'object' && data !== null && Array.isArray((data as InfinitePages).pages);
}

function mapPosts(data: unknown, mapper: (post: Post) => Post): unknown {
  if (isInfinitePages(data)) {
    return {
      ...data,
      pages: data.pages.map((page) => ({ ...page, items: page.items.map(mapper) })),
    };
  }
  if (isPage(data)) {
    return { ...data, items: data.items.map(mapper) };
  }
  return data;
}

export function updatePostInCaches(
  queryClient: QueryClient,
  postId: string,
  updater: (post: Post) => Post,
): void {
  const patch = (post: Post) => (post.id === postId ? updater(post) : post);

  queryClient.setQueriesData<Post>({ queryKey: ['post', postId] }, (data) =>
    isPost(data) ? updater(data) : data,
  );
  queryClient.setQueriesData({ queryKey: ['feed'] }, (data) => mapPosts(data, patch));
  queryClient.setQueriesData({ queryKey: ['replies'] }, (data) => mapPosts(data, patch));
}

export function updateAuthorFollowInCaches(
  queryClient: QueryClient,
  authorId: string,
  isFollowing: boolean,
): void {
  const patch = (post: Post): Post =>
    post.author.id === authorId ? { ...post, isFollowing } : post;

  queryClient.setQueriesData<Post>({ queryKey: ['post'] }, (data) =>
    isPost(data) ? patch(data) : data,
  );
  queryClient.setQueriesData({ queryKey: ['feed'] }, (data) => mapPosts(data, patch));
  queryClient.setQueriesData({ queryKey: ['replies'] }, (data) => mapPosts(data, patch));
}
