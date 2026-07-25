export class TrendingHashtagResponse {
  tag!: string;
  score!: number;

  static from(entry: { tag: string; score: number }): TrendingHashtagResponse {
    return { tag: entry.tag, score: entry.score };
  }
}
