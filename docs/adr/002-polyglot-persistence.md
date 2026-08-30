# ADR-002: Polyglot Persistence (Postgres + Neo4j + Redis)

**Status:** Accepted
**Date:** 2026-07-07

## Context

The project needs three fundamentally different data-access patterns:
strongly-consistent relational data with full-text search (users, posts,
likes); multi-hop social-graph traversal (mutuals, shortest path,
second-degree recommendations) — a genuinely hard problem in a relational
model past 2-3 hops; and low-latency ephemeral/cache state (feed sorted
sets, trending scores, rate limiting, presence, Socket.io pub/sub). No
single database is good at all three.

## Decision

Use three purpose-built databases: **PostgreSQL** (via Prisma) as the
source of truth for all core entities; **Neo4j** for the social graph only
(`FOLLOWS` relationships, dual-written alongside the authoritative Postgres
`Follow` row); **Redis** for feed cache, trending, rate limiting, presence,
and the Socket.io adapter.

## Alternatives Considered

- **Postgres only, simulating graph traversal with recursive CTEs** —
  rejected. Multi-hop queries (second-degree-by-topic, shortest path)
  become slow and the SQL becomes unreadable past 2 hops — this is
  precisely the problem a graph database exists to solve (see ADR-007).
- **MongoDB for flexible-schema needs** — rejected; see ADR-008.
- **A Redis-backed graph structure instead of Neo4j** — rejected. Doesn't
  support genuine Cypher-style multi-hop pattern matching; would end up
  reimplementing what Neo4j already does well.

## Consequences

**Positive:**

- Each access pattern gets a database that's actually good at it.
- The Neo4j-powered Graph View becomes a distinctive, hard-to-fake
  portfolio feature.
- Redis keeps hot paths (feed reads, like counts) fast without hammering
  Postgres.

**Negative:**

- Dual-write consistency risk: a `Follow` could succeed in Postgres and
  fail in Neo4j, or vice versa — must be handled explicitly at the
  application layer.
- Three separate connections, health checks, and failure modes to manage.
- Local dev requires a heavier docker-compose stack; a contributor needs
  working knowledge of three query languages (SQL, Cypher, Redis
  commands) instead of one.

**At higher scale we would consider:**

- A CDC (change-data-capture) pipeline (e.g., Debezium) to keep Neo4j in
  sync from Postgres as the single write path, removing the dual-write
  consistency risk from application code entirely.
