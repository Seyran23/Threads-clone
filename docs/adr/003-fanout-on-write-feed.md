# ADR-003: Fanout-on-Write Feed (CQRS)

**Status:** Accepted
**Date:** 2026-07-07

## Context

A user's home feed shows posts from everyone they follow, reverse
chronological, paginated, fast. The naive approach — query "latest N posts
from everyone I follow" at read time — costs scale with follow-count,
executed on every feed load. For a typical user this is fine; for a
viral/high-follower account, the read-time query becomes the bottleneck
exactly when it matters most (a viral post, everyone's feed loading it at
once).

## Decision

Fanout-on-write: when a post is created, a BullMQ worker pushes the post's
ID into every follower's own Redis sorted-set feed. Reading a feed is then
"read my own small sorted set" — cost independent of follow-count. For
accounts with more than 10,000 followers, skip fanout at write time (would
mean tens of thousands of Redis writes per post) and instead merge that
account's posts in at read time for their followers — a hybrid strategy.

## Alternatives Considered

- **Pure fanout-on-read** (query at load time) — rejected; doesn't scale,
  is the exact problem being solved.
- **Pure fanout-on-write, no hybrid** — rejected. A post from a
  very-high-follower-count account would trigger a write storm of tens of
  thousands of individual Redis writes; the 10k-follower cutoff exists
  specifically to avoid this.
- **A periodically-refreshed materialized view** — rejected. Feed
  staleness (posts not appearing until the next refresh) is unacceptable
  for a social feed; users expect near-real-time.

## Consequences

**Positive:**

- Feed reads are fast and cheap regardless of how many accounts a user
  follows.
- Write cost is paid once per post, amortized, not once per feed-read.

**Negative:**

- Feed generation is asynchronous — a post may not appear in followers'
  feeds until the fanout worker processes it, a brief delay rather than
  instant.
- More moving parts: a dedicated BullMQ queue, a completion-tracking
  table for idempotency.
- The 10k-follower cutoff is an arbitrary threshold that would need
  tuning against real usage patterns.
- Redis becomes a second source of truth that must stay consistent with
  Postgres — mitigated by treating Redis feed data as a rebuildable
  cache, never authoritative.

**At higher scale we would consider:**

- A proper streaming/event-log system (e.g., Kafka) for fanout instead of
  BullMQ-on-Redis, to handle far higher write throughput and allow
  feed-rebuild-from-log semantics.
