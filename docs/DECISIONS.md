# Threads-clone — Architectural Decisions

Quick-reference for design decisions locked in during planning.
Detailed reasoning lives in `docs/adr/`.

| Question | Decision |
|---|---|
| Monolith or microservices? | Modular monolith. MiniBank proves microservices; Threads-clone proves product execution. |
| Monorepo layout | pnpm workspaces: `apps/api`, `apps/web`, `packages/shared-types` |
| Backend framework | NestJS (continuity with MiniBank) |
| Frontend framework | Next.js 15 App Router |
| Primary database | PostgreSQL with Prisma |
| Graph database | Neo4j (real graph problems, not simulated with CTEs) |
| Cache / real-time state | Redis (feed cache, trending, rate limiting, socket adapter) |
| No MongoDB | Postgres JSONB covers flexible-payload needs with ACID guarantees |
| Comment model | Replies are Posts with parent pointer; depth denormalized; unlimited in schema; flattened at level 4 in UI |
| Feed generation | Fanout-on-write for accounts <10k followers; fanout-on-read hybrid for large accounts |
| Real-time transport | Socket.io with Redis adapter (horizontal scaling ready) |
| File uploads | S3 presigned URLs (client → S3 direct, no backend proxy) |
| Auth | JWT RS256, separate keys for access/refresh, family-based reuse detection (from MiniBank) |
| Background jobs | BullMQ on Redis |
| Search | Postgres full-text initially; Meilisearch if time permits |
| Image processing | Sharp for thumbnails, BlurHash for placeholders |
| CI | GitHub Actions, service containers for tests |
| Backend deployment | Railway |
| Frontend deployment | Vercel |
| ORM for graph | Direct Cypher via neo4j-driver (no ORM, kept intentional) |
| Async work strategy | BullMQ queues with durable Postgres source of truth. Workers are idempotent, retries with exponential backoff, safety-net sweep for stuck records. |
| Notification delivery | Durable-first: notification row created in same transaction as triggering event. Delivery via BullMQ worker, dedup by notification ID. |
| Feed fanout | BullMQ fanout worker pushes to followers' Redis feeds. Hybrid: large-follower accounts (>10k) skip fanout, merged at read time. |


## Backend folder structure

The NestJS backend at `apps/api/src/` uses this exact structure:
apps/api/src/
├── modules/              ← feature modules (business capabilities)
│   ├── auth/
│   ├── users/
│   ├── posts/
│   ├── feed/
│   ├── notifications/
│   ├── graph/
│   ├── search/
│   └── trending/
├── common/               ← cross-cutting concerns used by 2+ modules
│   ├── decorators/
│   ├── filters/
│   ├── guards/
│   ├── interceptors/
│   ├── pipes/
│   └── utils/
├── infrastructure/       ← adapters to external systems
│   ├── prisma/
│   ├── neo4j/
│   ├── redis/
│   └── s3/
└── main.ts

### Rules

- **Feature modules go under `modules/`.** Each is a NestJS module
  (`@Module` decorator) representing a business capability.
- **Cross-cutting concerns go under `common/`.** Only if used by two or
  more modules. If only one module needs it, keep it inside that module.
- **External-system adapters go under `infrastructure/`.** Prisma
  wrapper, Neo4j driver setup, Redis client, S3 client, etc. These are
  also NestJS modules but conceptually distinct from feature modules —
  they provide access to external systems, they don't do domain work.
- **Do not add new top-level folders under `src/`** without explicit
  approval. If a piece of code doesn't fit `modules/`, `common/`, or
  `infrastructure/`, that is a design signal to discuss, not to solve
  with a new folder.

### Within each module

Each feature module follows a consistent internal structure:
modules/posts/
├── posts.module.ts       ← @Module definition
├── posts.controller.ts   ← HTTP handlers, thin
├── posts.service.ts      ← business logic
├── posts.repository.ts   ← data access via Prisma
├── dto/                  ← request/response DTOs with class-validator
│   ├── create-post.dto.ts
│   └── post-response.dto.ts
├── entities/             ← domain types (if not Prisma-generated)
└── tests/            ← colocated tests

Some modules will have additional folders (e.g., a `strategies/`
subfolder in `auth/` for Passport strategies, an `events/` subfolder
in `notifications/` for BullMQ processors). Add subfolders only when
there is a clear grouping to justify one.



## Frontend folder structure

The Next.js frontend at `apps/web/` uses this structure:
apps/web/
├── src/
│   ├── app/                  ← Next.js App Router pages
│   │   ├── (auth)/           ← auth-related pages (login, register)
│   │   ├── (main)/           ← authenticated app shell
│   │   │   ├── feed/
│   │   │   ├── profile/
│   │   │   ├── graph/
│   │   │   └── search/
│   │   ├── api/              ← API routes (if any — prefer none)
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/               ← shadcn/ui components (generated)
│   │   ├── posts/            ← post-related components
│   │   ├── feed/             ← feed-related components
│   │   ├── notifications/    ← notification components
│   │   ├── graph/            ← graph view components
│   │   └── layout/           ← headers, sidebars, shells
│   ├── lib/
│   │   ├── api/              ← API client, typed fetchers
│   │   ├── hooks/            ← custom React hooks
│   │   ├── utils/            ← pure utilities
│   │   └── socket/           ← Socket.io client setup
│   ├── styles/
│   └── types/                ← shared TypeScript types
├── public/
├── next.config.js
└── tsconfig.json

### Rules

- **Pages go under `app/`** following Next.js App Router conventions.
  Use route groups `(name)` for logical grouping without affecting URLs.
- **Components go under `components/`**, grouped by feature. Only truly
  generic components (Button, Modal, Card if not from shadcn) go under
  `ui/` — everything else groups by domain.
- **Reusable logic goes under `lib/`.** Custom hooks in `hooks/`, API
  clients in `api/`, pure utilities in `utils/`.
- **Do not create page-specific components at the top level.** If a
  component is only used by one page, colocate it in that page's folder
  under `app/`.
- **shadcn/ui components generate into `components/ui/`.** Do not
  modify them heavily — customize via wrapping components in feature
  folders.