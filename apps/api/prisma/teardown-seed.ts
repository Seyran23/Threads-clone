import Redis from 'ioredis';

import { PrismaClient } from '../src/generated/prisma';

const SEED_EMAIL_DOMAIN = 'seed.local';

async function main() {
  const prisma = new PrismaClient();

  const users = await prisma.user.findMany({
    where: { email: { endsWith: `@${SEED_EMAIL_DOMAIN}` } },
    select: { id: true },
  });
  const userIds = users.map((u) => u.id);

  const posts = await prisma.post.findMany({
    where: { authorId: { in: userIds } },
    select: { id: true },
  });
  const postIds = posts.map((p) => p.id);

  const { count } = await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  console.log(
    `Deleted ${count} seed users (cascaded their posts/replies/likes/follows/notifications).`,
  );

  const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');

  const feedKeys = userIds.map((id) => `feed:${id}`);
  const likeKeys = postIds.map((id) => `post:${id}:likes`);
  if (feedKeys.length > 0 || likeKeys.length > 0) {
    await redis.del(...feedKeys, ...likeKeys);
  }

  if (postIds.length > 0) {
    const allFeedKeys = await redis.keys('feed:*');
    for (const key of allFeedKeys) {
      await redis.zrem(key, ...postIds);
    }
  }

  console.log('Cleared associated Redis feed and like-count keys.');
  console.log(
    'Note: any real S3 objects uploaded by the seed script (media/<userId>/seed-*.png and ' +
      'avatars/<userId>/seed-avatar.png) are not deleted here — the app IAM user has no ' +
      'delete permission on the bucket.',
  );

  await redis.quit();
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
