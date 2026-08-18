import { deflateSync } from 'node:zlib';

import { NestFactory } from '@nestjs/core';

import { AppModule } from '@/app.module';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import { S3Service } from '@/infrastructure/s3/s3.service';
import { AuthService } from '@/modules/auth/auth.service';
import { FeedRepository } from '@/modules/feed/feed.repository';
import { FollowsService } from '@/modules/follows/follows.service';
import { PostsService } from '@/modules/posts/posts.service';
import { UsersService } from '@/modules/users/users.service';

const SEED_PASSWORD = 'Passw0rd!2345';
const SEED_EMAIL_DOMAIN = 'seed.local';

const USERNAMES = [
  'nova_ember',
  'pixel_drift',
  'cosmic_ray',
  'echo_static',
  'neon_wolf',
  'quiet_storm',
  'wild_orbit',
  'lucid_byte',
  'paper_moon',
  'iron_finch',
  'velvet_fox',
  'amber_tide',
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

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buf) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([length, typeBuf, data, crc]);
}

/** Builds a valid solid-color PNG from scratch, so seed images/avatars don't need a canvas dependency or hardcoded base64 blobs. */
function makeSolidPng(size: number, [r, g, b]: [number, number, number]): Buffer {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);
  ihdrData.writeUInt32BE(size, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 2; // color type: RGB
  const ihdr = pngChunk('IHDR', ihdrData);

  const rowBytes = size * 3;
  const raw = Buffer.alloc((rowBytes + 1) * size);
  for (let y = 0; y < size; y++) {
    const rowStart = y * (rowBytes + 1);
    raw[rowStart] = 0; // filter type: none
    for (let x = 0; x < size; x++) {
      const pixelStart = rowStart + 1 + x * 3;
      raw[pixelStart] = r;
      raw[pixelStart + 1] = g;
      raw[pixelStart + 2] = b;
    }
  }
  const idat = pngChunk('IDAT', deflateSync(raw));
  const iend = pngChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

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
  const usersService = app.get(UsersService);
  const s3Service = app.get(S3Service);
  const feedRepository = app.get(FeedRepository);
  const prisma = app.get(PrismaService);

  console.log('Removing any existing seed data...');
  await prisma.user.deleteMany({ where: { email: { endsWith: `@${SEED_EMAIL_DOMAIN}` } } });

  console.log(`Creating ${USERNAMES.length} users with profile photos...`);
  const users: { id: string; username: string; email: string }[] = [];
  for (const [index, username] of USERNAMES.entries()) {
    const email = `${username}@${SEED_EMAIL_DOMAIN}`;
    const { user } = await authService.register({ email, username, password: SEED_PASSWORD });

    const hue = Math.round((index / USERNAMES.length) * 360);
    const avatarKey = `avatars/${user.id}/seed-avatar.png`;
    await s3Service.putObject(avatarKey, makeSolidPng(256, hslToRgb(hue, 0.55, 0.55)), 'image/png');
    await usersService.updateProfile(user.id, { avatarKey });

    users.push({ id: user.id, username, email });
  }

  const [alice, pendingRequester, ...rest] = users;
  console.log(
    `Everyone follows ${alice.username} (except ${pendingRequester.username}, held back for a pending follow request demo), plus a random follow graph...`,
  );
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

  console.log('Creating posts (many with real images)...');
  const postCount = 50;
  const imagePostCount = 16;
  const imagePostIndexes = new Set(
    shuffle(Array.from({ length: postCount }, (_, i) => i)).slice(0, imagePostCount),
  );

  const posts: {
    id: string;
    authorId: string;
    createdAt: Date;
  }[] = [];

  for (let i = 0; i < postCount; i++) {
    const author = i % 5 === 0 ? alice : users[randomInt(0, users.length - 1)];
    const content = `${POST_TEMPLATES[i % POST_TEMPLATES.length]} (${i + 1})`;

    let mediaKeys: string[] | undefined;
    if (imagePostIndexes.has(i)) {
      const numImages = Math.random() < 0.25 ? 2 : 1;
      mediaKeys = [];
      for (let n = 0; n < numImages; n++) {
        const key = `media/${author.id}/seed-post-${i}-${n}.png`;
        await s3Service.putObject(
          key,
          makeSolidPng(480, hslToRgb(randomInt(0, 359), 0.55, 0.55)),
          'image/png',
        );
        mediaKeys.push(key);
      }
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

  console.log(
    `Making ${alice.username} private and queuing a pending follow request from ${pendingRequester.username}...`,
  );
  await usersService.updateProfile(alice.id, { isPrivate: true });
  await followsService.followUser(pendingRequester.id, alice.id);

  const elapsedSeconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`\nDone in ${elapsedSeconds}s.`);
  console.log(`Seeded ${users.length} users, ${posts.length} posts, ${replies.length} replies.`);
  console.log(
    `${alice.username} is private with a pending follow request from ${pendingRequester.username} — log in as ${alice.username} and check Activity to see it.`,
  );
  console.log(`\nAll seed users share the password: ${SEED_PASSWORD}`);
  console.log('Log in as any of:');
  users.forEach((u) => console.log(`  ${u.username}  <${u.email}>`));

  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
