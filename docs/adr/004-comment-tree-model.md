# ADR-004: Comment Tree Model

**Status:** Accepted
**Date:** 2026-07-07

## Context

Threads-style replies form an unbounded tree — a reply can itself have
replies, indefinitely deep in principle — but the UI only ever needs to
show a flattened few levels before a "show more replies" affordance. A
dedicated `Comment` entity with its own table would duplicate almost
everything `Post` already has: content, likes, media, hashtags, author.

## Decision

Replies are Posts — the same `Post` model, self-referencing via an
optional `parentId`. A denormalized `depth` integer, computed once at
insert time (`parent.depth + 1`), avoids recursive CTE queries at read
time just to know how deep a reply is. The UI flattens anything past depth
3 (the 4th level) into a "continue thread" affordance, but the schema
itself has no depth limit — that is a UI-layer decision, not a data
constraint.

## Alternatives Considered

- **A separate `Comment`/`Reply` entity** — rejected. Replies need
  everything a post needs — duplicating columns, indexes, repository
  methods, and response mapping for no real benefit. Replying-to-a-reply
  would need its own parent-pointer logic anyway, identical to what
  `Post` already needs.
- **Materialized path or nested-set model** (storing the full ancestor
  path per row) — rejected. Over-engineered for this project's actual
  read pattern (fetch direct children of a given post, not "all
  descendants of X" in one query).
- **Computing depth at read time via recursive CTE** — rejected. Exactly
  the kind of read-time recursive query this project's Neo4j usage
  (ADR-002/007) exists to avoid elsewhere; computing it once at write
  time is cheap and keeps reads simple.

## Consequences

**Positive:**

- One model, one repository, one response type serves both posts and
  replies.
- Likes, hashtags, and media all work on replies for free, since they
  already work on `Post`.
- Depth is available without a query.

**Negative:**

- `depth` is a write-time snapshot. This is safe here only because
  `parentId` cascades on delete (`onDelete: Cascade`) — a deleted parent
  takes its replies with it, so orphaned rows with stale depth never
  occur.
- A single, large `posts` table holds top-level posts and every level of
  reply together, which will eventually need composite indexes tuned
  around `parentId` access patterns as the table grows.

**At higher scale we would consider:**

- Partitioning the `posts` table by depth or by `created_at` range if
  reply-heavy hot threads start affecting top-level-post query
  performance.
