# ADR-010: Cross-Database Consistency via Outbox for Neo4j Sync

**Status:** Accepted
**Date:** 2026-07-17

## Context

Postgres is the source of truth for the social graph (the `follows`
table), but Neo4j also needs to reflect that same graph, to serve graph
queries efficiently (mutuals, shortest path, the Graph View). These are
two independent databases — there is no shared transaction spanning
both. Prisma's `$transaction` only guarantees atomicity within Postgres
itself. If a follow/unfollow wrote to Postgres and then called Neo4j
directly, any failure between the two calls (Neo4j down, a network
blip, the process crashing) would leave the two databases permanently
out of sync, with no record that anything was ever supposed to happen.

## Decision

Every follow/unfollow write commits a `GraphSyncOutbox` row in Postgres
in the *same transaction* as the `follows` table write itself. The
outbox row records what needs to happen in Neo4j
(`FOLLOW_CREATED`/`FOLLOW_DELETED` + payload). Only after that
transaction commits do we enqueue a BullMQ job to actually apply the
change as a Cypher `MERGE`/`DELETE` against Neo4j.

The `GraphSyncProcessor` is idempotent — `MERGE`/`DELETE` are naturally
safe to run twice — retries with exponential backoff, and a 30-second
cron sweep re-enqueues any outbox row still stuck `PENDING`, catching
jobs lost entirely (e.g. a Redis restart mid-processing). After 10
total attempts (tracked via a persistent `attempts` counter, separate
from BullMQ's own retry count), the row is marked `FAILED` for manual
review instead of being retried forever.

This is a specific application of the general durable-first pattern
(ADR-009) to the specific problem of keeping two independent databases
consistent without a distributed transaction. The same shape — durable
row first, queue second, idempotent worker, cron safety net — was later
reused for feed fanout (Postgres → Redis feed) and notification
delivery (Postgres → Socket.io), which is the strongest evidence the
pattern generalizes rather than being a one-off fix for Neo4j
specifically.

## Alternatives Considered

- **Two-phase commit (2PC) across Postgres and Neo4j** — rejected.
  Neo4j doesn't support XA-style distributed transactions the way
  Postgres does, and even where 2PC is available it introduces its own
  blocking/availability failure modes, far more operational complexity
  than this project's scale justifies.
- **Change Data Capture off the Postgres WAL** (e.g. Debezium) streaming
  into Neo4j — rejected for now. A legitimate enterprise pattern, but it
  requires a whole separate streaming infrastructure component this
  project has explicitly decided against, for a consistency guarantee
  the outbox + BullMQ approach already delivers at this scale.
- **Writing to Neo4j directly inside the request, no outbox** —
  rejected. This is exactly the fire-and-forget anti-pattern ADR-009
  forbids: a Neo4j hiccup at the wrong instant silently and permanently
  desyncs the graph, with zero trace a sync was ever needed.
- **Making Neo4j the source of truth instead of Postgres** — rejected.
  Postgres already owns the `User`/`Follow` relationship for reasons
  unrelated to the graph (feed fanout's follower lookups, notification
  recipient resolution); Neo4j exists purely to serve graph-shaped
  queries fast, not to own the data.

## Consequences

**Positive:**

- Postgres and Neo4j can never silently and permanently diverge — a
  gap is always visible, either as a `PENDING` row the sweep will catch,
  or a `FAILED` row flagged for review.
- Neo4j being temporarily unreachable never blocks a follow/unfollow
  request from succeeding — the write to Postgres, the source of truth,
  always completes independently of Neo4j's availability.
- The Cypher operations' natural idempotency means duplicate-enqueue
  races from the cron sweep are harmless by construction, not by
  careful case-by-case handling.

**Negative:**

- There's a real, small window where Postgres says "following" but
  Neo4j hasn't caught up yet — anything reading directly from Neo4j
  (e.g. the future Graph View) can be briefly stale immediately after a
  follow.
- Two extra moving parts (a queue plus a scheduled sweep) for every
  cross-database relationship that needs this treatment — more
  operational surface than a naive direct write, though this is the
  same tradeoff ADR-009 already accepted project-wide.
- If Neo4j stays down longer than the outbox's max-attempts window,
  affected rows land in `FAILED` and need manual intervention (a
  re-drive script or admin view) rather than resolving themselves —
  not yet built, since no real failures have occurred to warrant it.

**At higher scale we would consider:**

- A genuine CDC pipeline (e.g. Debezium reading the Postgres WAL) if
  the number of cross-database sync relationships grows beyond what a
  handful of outbox tables can reasonably cover.
- An admin endpoint or dashboard for `FAILED` outbox rows, so manual
  review has a real interface instead of a raw SQL query.
