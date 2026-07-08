import { FeedEntry } from '../interface/feed-entry.interface';

import { mergeFeedEntries } from './merge-feed-entries.util';

describe('mergeFeedEntries', () => {
  it('interleaves two descending lists into a single descending list', () => {
    const a: FeedEntry[] = [
      { postId: 'a-1', score: 300 },
      { postId: 'a-2', score: 100 },
    ];
    const b: FeedEntry[] = [
      { postId: 'b-1', score: 200 },
      { postId: 'b-2', score: 50 },
    ];

    const merged = mergeFeedEntries(a, b, 10);

    expect(merged.map((e) => e.postId)).toEqual(['a-1', 'b-1', 'a-2', 'b-2']);
  });

  it('caps the result at limit', () => {
    const a: FeedEntry[] = [
      { postId: 'a-1', score: 300 },
      { postId: 'a-2', score: 200 },
    ];
    const b: FeedEntry[] = [{ postId: 'b-1', score: 250 }];

    const merged = mergeFeedEntries(a, b, 2);

    expect(merged.map((e) => e.postId)).toEqual(['a-1', 'b-1']);
  });

  it('dedupes a postId that appears in both lists, keeping only one copy', () => {
    const a: FeedEntry[] = [{ postId: 'shared', score: 300 }];
    const b: FeedEntry[] = [{ postId: 'shared', score: 300 }];

    const merged = mergeFeedEntries(a, b, 10);

    expect(merged).toEqual([{ postId: 'shared', score: 300 }]);
  });

  it('handles one list being empty', () => {
    const a: FeedEntry[] = [{ postId: 'a-1', score: 100 }];

    expect(mergeFeedEntries(a, [], 10)).toEqual(a);
    expect(mergeFeedEntries([], a, 10)).toEqual(a);
  });
});
