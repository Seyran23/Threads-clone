import { FeedEntry } from '../interface/feed-entry.interface';

export function mergeFeedEntries(a: FeedEntry[], b: FeedEntry[], limit: number): FeedEntry[] {
  const merged: FeedEntry[] = [];
  const seen = new Set<string>();
  let i = 0;
  let j = 0;

  while (merged.length < limit && (i < a.length || j < b.length)) {
    const fromA = a[i];
    const fromB = b[j];

    let next: FeedEntry;
    if (fromA && (!fromB || fromA.score >= fromB.score)) {
      next = fromA;
      i++;
    } else {
      next = fromB;
      j++;
    }

    if (!seen.has(next.postId)) {
      seen.add(next.postId);
      merged.push(next);
    }
  }

  return merged;
}
