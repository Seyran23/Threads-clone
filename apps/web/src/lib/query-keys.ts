export const queryKeys = {
  currentUser: ['currentUser'] as const,
  feed: ['feed'] as const,
  post: (id: string) => ['post', id] as const,
  replies: (parentId: string) => ['replies', parentId] as const,
};
