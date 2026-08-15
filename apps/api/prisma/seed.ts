import { NestFactory } from '@nestjs/core';

import { AppModule } from '@/app.module';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import { S3Service } from '@/infrastructure/s3/s3.service';
import { AuthService } from '@/modules/auth/auth.service';
import { FeedRepository } from '@/modules/feed/feed.repository';
import { FollowsService } from '@/modules/follows/follows.service';
import { PostsService } from '@/modules/posts/posts.service';

const SEED_PASSWORD = 'Passw0rd!2345';
const SEED_PREFIX = 'seed_';

const USERNAMES = [
  'alice',
  'bob',
  'carol',
  'dave',
  'erin',
  'frank',
  'grace',
  'heidi',
  'ivan',
  'judy',
  'mallory',
  'oscar',
];

const POST_TEMPLATES = [
  'Finally got the feed fanout working end to end #buildinpublic',
  'Redis sorted sets are a great fit for a feed timeline #redis',
  'Neo4j makes the mutuals query trivial compared to recursive SQL #neo4j',
  'Anyone else find cursor pagination way easier to reason about than offset?',
  'Shipped BullMQ retries with a cron sweep as a safety net today',
  'Presigned S3 uploads mean the backend never touches the file bytes #s3',
  'Dark mode by default, finally #darkmode',
  'Testcontainers make integration tests actually trustworthy',
  'NestJS module boundaries are paying off as this grows #nestjs',
  'Wrote an ADR today instead of just doing the thing. Worth it.',
  'Optimistic UI updates make likes feel instant #frontend',
  'TanStack Query cache invalidation finally clicked for me',
  'Comment trees as self-referencing posts, simpler than I expected',
  'Argon2 over bcrypt, no real downside I can find',
  'Correlation IDs threaded through every log line, so satisfying',
  'Just following people to see the feed fill up #threadsclone',
  'Postgres generated columns for full text search, no separate index service needed',
  'Hybrid fanout: normal users get pushed, celebrities get merged at read time',
  'The reply depth model is just posts with a parent pointer #postgres',
  'Rate limiting on write endpoints saved me from my own test script today',
  'BlurHash placeholders make image loading feel so much smoother',
  'Socket.io presence tracking multi-tab sessions correctly was trickier than expected',
  'Six months ago I would not have believed I could build this solo',
  'Coffee first, then code review',
  'Weekend project turned into a whole platform apparently',
];

const REPLY_TEMPLATES = [
  'Completely agree with this',
  'Wait, how did you handle the edge case where it fails halfway through?',
  'This is exactly what I needed to read today',
  'Following you now, more of this please',
  'Curious what made you choose that over the alternative',
  'Saved me an afternoon of debugging, thank you',
  'Same experience here honestly',
  'Can you share more details on the setup?',
  'This deserves way more attention',
  'Had the exact same bug last week',
];

const IMAGE_COLORS: Record<string, string> = {
  red: 'iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAIAAAD/gAIDAAAAtUlEQVR4nO3QUQkAIBTAQDO9/lEMYwV/ZAgHCzBu7RldtvKDj4IFC1YeLFiw8mDBgpUHCxasPFiwYOXBggUrDxYsWHmwYMHKgwULVh4sWLDyYMGClQcLFqw8WLBg5cGCBSsPFixYebBgwcqDBQtWHixYsPJgwYKVBwsWrDxYsGDlwYIFKw8WLFh5sGDByoMFC1YeLFiw8mDBgpUHCxasPFiwYOXBggUrDxYsWHmwYMHKgwXrTQfr89bRBdCQ6AAAAABJRU5ErkJggg==',
  blue: 'iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAIAAAD/gAIDAAAAtUlEQVR4nO3QQQkAIADAQDMZx+yGsYIfGcLBAowbc21dNvKDj4IFC1YeLFiw8mDBgpUHCxasPFiwYOXBggUrDxYsWHmwYMHKgwULVh4sWLDyYMGClQcLFqw8WLBg5cGCBSsPFixYebBgwcqDBQtWHixYsPJgwYKVBwsWrDxYsGDlwYIFKw8WLFh5sGDByoMFC1YeLFiw8mDBgpUHCxasPFiwYOXBggUrDxYsWHmwYMHKgwXrTQf4MPGrUiGTZAAAAABJRU5ErkJggg==',
  green:
    'iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAIAAAD/gAIDAAAAtUlEQVR4nO3QQQkAIADAQDMZx5wGtIIfGcLBAowbcy9dNvKDj4IFC1YeLFiw8mDBgpUHCxasPFiwYOXBggUrDxYsWHmwYMHKgwULVh4sWLDyYMGClQcLFqw8WLBg5cGCBSsPFixYebBgwcqDBQtWHixYsPJgwYKVBwsWrDxYsGDlwYIFKw8WLFh5sGDByoMFC1YeLFiw8mDBgpUHCxasPFiwYOXBggUrDxYsWHmwYMHKgwXrTQfe89bRzhwF0gAAAABJRU5ErkJggg==',
  orange:
    'iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAIAAAD/gAIDAAAAtUlEQVR4nO3QQQkAIADAQOMY1pzmsIIfGcLBAowbe01dNvKDj4IFC1YeLFiw8mDBgpUHCxasPFiwYOXBggUrDxYsWHmwYMHKgwULVh4sWLDyYMGClQcLFqw8WLBg5cGCBSsPFixYebBgwcqDBQtWHixYsPJgwYKVBwsWrDxYsGDlwYIFKw8WLFh5sGDByoMFC1YeLFiw8mDBgpUHCxasPFiwYOXBggUrDxYsWHmwYMHKgwXrTQeWmJNDcs4f+AAAAABJRU5ErkJggg==',
};

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function randomPastDate(maxDaysAgo: number, minMinutesAgo = 5): Date {
  const ms = randomInt(minMinutesAgo * 60_000, maxDaysAgo * 24 * 60 * 60_000);
  return new Date(Date.now() - ms);
}

function randomDateBetween(start: Date, end: Date): Date {
  const startMs = start.getTime();
  const endMs = Math.max(end.getTime(), startMs + 60_000);
  return new Date(randomInt(startMs, endMs));
}

async function main() {
  const startedAt = Date.now();
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });

  const authService = app.get(AuthService);
  const postsService = app.get(PostsService);
  const followsService = app.get(FollowsService);
  const s3Service = app.get(S3Service);
  const feedRepository = app.get(FeedRepository);
  const prisma = app.get(PrismaService);

  console.log('Removing any existing seed data...');
  await prisma.user.deleteMany({ where: { username: { startsWith: SEED_PREFIX } } });

  console.log(`Creating ${USERNAMES.length} users...`);
  const users: { id: string; username: string; email: string }[] = [];
  for (const name of USERNAMES) {
    const username = `${SEED_PREFIX}${name}`;
    const email = `${SEED_PREFIX}${name}@example.com`;
    const { user } = await authService.register({ email, username, password: SEED_PASSWORD });
    users.push({ id: user.id, username, email });
  }

  const [alice, ...rest] = users;
  console.log(`Everyone follows ${alice.username}, plus a random follow graph...`);
  for (const user of rest) {
    await followsService.followUser(user.id, alice.id);
  }
  for (const user of users) {
    const candidates = users.filter((u) => u.id !== user.id && u.id !== alice.id);
    const targets = shuffle(candidates).slice(0, randomInt(1, 4));
    for (const target of targets) {
      try {
        await followsService.followUser(user.id, target.id);
      } catch {
        // already following, ignore
      }
    }
  }

  console.log('Creating posts (some with real images)...');
  const imageEntries = Object.entries(IMAGE_COLORS);
  const postCount = 50;
  const imagePostIndexes = new Set(
    shuffle(Array.from({ length: postCount }, (_, i) => i)).slice(0, imageEntries.length),
  );

  const posts: {
    id: string;
    authorId: string;
    createdAt: Date;
  }[] = [];

  let imageIndex = 0;
  for (let i = 0; i < postCount; i++) {
    const author = i % 5 === 0 ? alice : users[randomInt(0, users.length - 1)];
    const content = `${POST_TEMPLATES[i % POST_TEMPLATES.length]} (${i + 1})`;

    let mediaKeys: string[] | undefined;
    if (imagePostIndexes.has(i)) {
      const [colorName, base64] = imageEntries[imageIndex % imageEntries.length];
      imageIndex++;
      const key = `media/${author.id}/seed-${colorName}-${i}.png`;
      await s3Service.putObject(key, Buffer.from(base64, 'base64'), 'image/png');
      mediaKeys = [key];
    }

    const post = await postsService.createPost(author.id, { content, mediaKeys });
    posts.push({ id: post.id, authorId: author.id, createdAt: randomPastDate(20) });
  }

  console.log('Creating replies...');
  const repliedParents = shuffle(posts).slice(0, 15);
  const replies: { id: string; parentCreatedAt: Date }[] = [];
  for (const parent of repliedParents) {
    const replyCount = randomInt(1, 3);
    for (let r = 0; r < replyCount; r++) {
      const candidates = users.filter((u) => u.id !== parent.authorId);
      const author = candidates[randomInt(0, candidates.length - 1)];
      const content = REPLY_TEMPLATES[randomInt(0, REPLY_TEMPLATES.length - 1)];
      const reply = await postsService.createReply(author.id, parent.id, { content });
      replies.push({ id: reply.id, parentCreatedAt: parent.createdAt });
    }
  }

  console.log('Waiting for fanout jobs to drain before backdating timestamps...');
  await new Promise((resolve) => setTimeout(resolve, 3000));

  console.log('Backdating post timestamps and re-scoring feeds...');
  for (const post of posts) {
    await prisma.$executeRaw`UPDATE posts SET created_at = ${post.createdAt}, updated_at = ${post.createdAt} WHERE id = ${post.id}`;
    const followerIds = await feedRepository.findFollowerIds(prisma, post.authorId);
    const recipients = [...followerIds, post.authorId];
    for (const recipientId of recipients) {
      await feedRepository.pushToFeed(recipientId, post.id, post.createdAt.getTime());
    }
  }

  console.log('Backdating reply timestamps...');
  for (const reply of replies) {
    const replyTime = randomDateBetween(reply.parentCreatedAt, new Date());
    await prisma.$executeRaw`UPDATE posts SET created_at = ${replyTime}, updated_at = ${replyTime} WHERE id = ${reply.id}`;
  }

  console.log('Liking posts and replies (skipping self-likes)...');
  const allPostIds = [...posts.map((p) => p.id), ...replies.map((r) => r.id)];
  const postAuthorById = new Map(posts.map((p) => [p.id, p.authorId]));
  for (const postId of allPostIds) {
    const authorId = postAuthorById.get(postId);
    for (const user of users) {
      if (user.id === authorId) {
        continue;
      }
      if (Math.random() < 0.35) {
        try {
          await postsService.likePost(user.id, postId);
        } catch {
          // ignore rare races
        }
      }
    }
  }

  const elapsedSeconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`\nDone in ${elapsedSeconds}s.`);
  console.log(`Seeded ${users.length} users, ${posts.length} posts, ${replies.length} replies.`);
  console.log(`\nAll seed users share the password: ${SEED_PASSWORD}`);
  console.log('Log in as any of:');
  users.forEach((u) => console.log(`  ${u.username}  <${u.email}>`));

  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
