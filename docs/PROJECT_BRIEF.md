# Threads-clone — Project Brief

## What this is
A Threads-style social platform demonstrating polyglot persistence,
real-time collaboration at product scale, event-driven feed generation
(CQRS via fanout-on-write), and a distinctive graph-based social
visualization. Built as the second flagship portfolio project to
demonstrate full-stack capability with backend depth AND frontend polish.

## What this is NOT
- A production social network (no moderation infra, no ML ranking)
- A messaging platform (no DMs — separate product concern)
- A community/groups platform (scope creep)
- A mobile app (web only, but mobile-responsive)
- A video platform (images only)

If a feature does not demonstrate a specific technical or product-craft
skill, it does not go in.

## Core capabilities
1. User registration and authentication (JWT with refresh rotation)
2. Post creation with text + up to 4 images, 500-char limit
3. Threaded replies (unlimited depth in schema, UI-flattened at level 4)
4. Likes, reposts, quote-reposts
5. Follow/unfollow with real social graph in Neo4j
6. Home feed (fanout-on-write, chronological, real-time updates)
7. Real-time notifications (likes, replies, mentions, follows)
8. Presence indicators (who's online)
9. Search (users + posts, Postgres full-text)
10. Trending hashtags (Redis sorted sets with time decay)
11. Profile pages with post history and follower stats
12. **The Graph View** — force-directed interactive visualization of the
    user's social network, powered by Neo4j queries
13. Media uploads via S3 presigned URLs with automatic thumbnails


- **Backend:** NestJS monolith, deployed as one service
- **Frontend:** Next.js 15 App Router, deployed to Vercel
- **Primary DB:** PostgreSQL (users, posts, replies, likes, follows,
  notifications) via Prisma
- **Graph DB:** Neo4j (social graph, traversal queries, graph view data)
- **Cache/Real-time:** Redis (feed cache, trending, rate limiting,
  presence, Socket.io adapter)
- **Real-time transport:** Socket.io with Redis adapter
- **File storage:** AWS S3 with presigned uploads
- **Background jobs:** BullMQ on Redis (fanout, notifications, image processing)
- **Deployment:** Backend on Railway, frontend on Vercel

## The four hard problems being solved

### 1. Fanout-on-write feed generation (CQRS)
Naive approach: query all posts from all people you follow, order by
time. Doesn't scale — a user following 500 people means a query across
500 authors' post histories per feed load.

Fanout-on-write approach: when a post is created, push the post ID into
the feed cache of every follower (Redis sorted set per user, scored by
timestamp). Feed load becomes one cheap Redis read.

Hybrid handling for high-follower accounts: users with >10k followers
skip fanout and their posts are merged at read time to prevent write
storms. Document this decision in ADR.

### 2. Reliable async work without microservices
Notifications, feed fanout, and image processing all happen async. But
"async" cannot mean "sometimes lost." Strategy: write the intent
durably to Postgres in the same transaction as the triggering event,
then enqueue a BullMQ job for delivery. Workers are idempotent and
retried with exponential backoff. A periodic sweep re-enqueues any
records stuck in PENDING state. Postgres is the source of truth; the
queue is the fast path.

### 3. Real-time updates without breaking scale
Socket.io with Redis adapter allows horizontal scaling of the socket
layer. Users subscribe to their own feed channel and their own
notification channel. Async work in BullMQ handlers pushes to sockets
where users are online, with best-effort direct emission and durable
fallback via the notification table.

### 4. Graph queries at UI speed
Social graph lives in Neo4j. Queries like "mutual followers between A
and B," "shortest path between two users," "second-degree connections
who follow topic X" are single Cypher queries. The Graph View page
uses these queries to power a force-directed D3 visualization with
filters and drill-downs.



## Tech stack
- Node 24 LTS, TypeScript strict mode
- NestJS 10 backend (single service, modular monolith structure)
- Next.js 15 (App Router) + Tailwind + shadcn/ui + Framer Motion
  + TanStack Query + react-hook-form + zod
- PostgreSQL 16 + Prisma ORM
- Neo4j 5 + official neo4j-driver
- Redis 7 (with ioredis client)
- Socket.io 4 (with @socket.io/redis-adapter)
- AWS S3 (or MinIO for local dev)
- Sharp for image processing
- BullMQ for background jobs
- JWT RS256 + argon2
- class-validator + zod
- Jest + Supertest + Testcontainers
- Pino for structured logging
- Docker + docker-compose for local
- pnpm workspaces (monorepo: backend + frontend + shared types)
- GitHub Actions for CI
- Railway + Vercel for deployment

## Quality standards
- ESLint + Prettier + Husky pre-commit hooks
- TypeScript strict mode, no `any` without justification comment
- Unit tests on business logic, integration tests on critical paths,
  e2e tests on happy paths
- OpenAPI documentation via Swagger
- Health check endpoint with dependency checks (Postgres, Redis, Neo4j)
- Structured logging with request correlation IDs
- Graceful shutdown handling
- Multi-stage Dockerfile, non-root user
- Helmet, CORS, rate limiting, input validation on all endpoints
- Prisma migrations run via `prisma migrate deploy` in CI

## Frontend quality bar
This is the project where the frontend must be genuinely polished.
Standards:
- Loading, error, empty states on every data view
- Optimistic updates for likes, follows, replies
- Skeleton loaders, not spinners, for perceived speed
- Framer Motion transitions on lists, modals, notifications
- Accessible: keyboard nav, semantic HTML, Lighthouse 90+
- Responsive: 375px (mobile), 768px (tablet), 1440px (desktop) all tested
- Real focus states, real hover states, real disabled states
- Blur-up image placeholders (Next/Image + BlurHash or similar)
- Consistent spacing and typography (shadcn defaults + minimal customization)

## Documentation deliverables
- Top-level README with hero screenshot/GIF and live demo link
- `docs/architecture.md` — system design deep dive with diagrams
- `docs/adr/` — Architecture Decision Records:
  - ADR-001: Modular monolith over microservices (this time)
  - ADR-002: Polyglot persistence — Postgres + Neo4j + Redis
  - ADR-003: Fanout-on-write CQRS for feed generation
  - ADR-004: Comment tree model (parent pointer, UI flattening)
  - ADR-005: Real-time transport (Socket.io + Redis adapter)
  - ADR-006: S3 presigned URLs over proxy uploads
  - ADR-007: Neo4j vs recursive CTEs
  - ADR-008: Postgres JSONB over MongoDB for flexible payloads
- OpenAPI spec hosted live
- Loom demo video (3 min, showing feed real-time + graph view)
- Blog post: "Building a Real-Time Social Feed with CQRS in Node.js"

## Out of scope (do not add)
- Direct messages
- Communities, groups, spaces
- Algorithmic "for you" ranking
- Video uploads
- Live video / audio
- Editing posts after publish
- Push notifications to mobile OS
- Multi-language i18n
- AI content generation features
- Blocking/muting UX beyond basic block
- Advanced moderation tools
- Verified badges / user tiers