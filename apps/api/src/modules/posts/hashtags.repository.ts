import { Injectable } from '@nestjs/common';

import { Hashtag } from '@/generated/prisma';
import { PrismaClientOrTx } from '@/infrastructure/prisma/prisma.types';

@Injectable()
export class HashtagsRepository {
  async findOrCreateMany(tx: PrismaClientOrTx, tags: string[]): Promise<Hashtag[]> {
    const hashtags: Hashtag[] = [];
    for (const tag of tags) {
      hashtags.push(await tx.hashtag.upsert({ where: { tag }, create: { tag }, update: {} }));
    }
    return hashtags;
  }
}
