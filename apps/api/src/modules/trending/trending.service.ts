import { Injectable } from '@nestjs/common';

import { TrendingHashtagResponse } from './response/trending-hashtag.response';
import { TrendingRepository } from './trending.repository';

@Injectable()
export class TrendingService {
  constructor(private readonly trendingRepository: TrendingRepository) {}

  async recordUsage(tags: string[]): Promise<void> {
    await Promise.all(tags.map((tag) => this.trendingRepository.recordUsage(tag)));
  }

  async getTopHashtags(limit: number): Promise<TrendingHashtagResponse[]> {
    const entries = await this.trendingRepository.getTop(limit);
    return entries.map((entry) => TrendingHashtagResponse.from(entry));
  }
}
