# ADR-009: Async Reliability — Durable-First Writes

**Status:** Accepted
**Date:** 2026-07-07

## Context

Background work (feed fanout, notification delivery, image processing)
happens via BullMQ jobs. If a job is only ever created by calling
`queue.add(...)` with no other record, a Redis outage, a crash between
"decide to do work" and "enqueue the job," or an operator error (e.g.,
someone flushing the Redis queue) silently loses that work forever, with
no trace it was ever supposed to happen.

## Decision

Every piece of async work is preceded by a durable write to Postgres, in
the same transaction as the triggering event, before the BullMQ job is
ever enqueued. The queue is a fast-path delivery mechanism; Postgres is
the source of truth for "this work needs to happen." Workers are
idempotent (safe to run twice — check current status before acting,
tolerate re-processing the same job), retry with exponential backoff, and
a periodic safety-net sweep re-enqueues anything still stuck in a pending
state after a timeout window, guaranteeing eventual completion even if a
specific job is lost from the queue itself.

The image-processing pipeline is the concrete example already
implemented: `PostsService.createPost()` creates the `Post` and its
`Media` rows (`processingStatus: QUEUED`) inside one transaction; only
*after* that transaction commits does it call
`ImageProcessingQueue.enqueueThumbnailJob()`. If Redis were down at that
exact moment, the `Media` row already exists with a durable `QUEUED`
status — nothing is lost, only delayed. The worker itself is idempotent:
re-running a job for a `Media` row that's already `READY` just regenerates
the same thumbnail and overwrites the same fields, no side effects from
running twice.

## Alternatives Considered

- **Enqueue-only, no durable record** (`await queue.add(...)` with nothing
  else) — rejected. This is exactly the silent-data-loss failure mode
  being designed against; explicitly forbidden by this project's own
  coding standards.
- **A full outbox-pattern implementation** with a separate relay process
  polling an outbox table — considered, adopted in simplified form. The
  durable-Postgres-row-first approach is essentially a simplified
  single-process version of the outbox pattern, without a separate relay
  process, since BullMQ+Redis already provides the delivery mechanism
  once the durable intent exists.
- **A message broker with built-in durability** (RabbitMQ, Kafka) instead
  of Redis/BullMQ — rejected for this project. Explicitly out of scope
  (demonstrating that reliability doesn't require adopting a heavier
  message-broker stack), and BullMQ-on-Redis plus the durable-first
  pattern achieves the same reliability guarantee at this project's
  scale.

## Consequences

**Positive:**

- No async work is ever silently lost, even under Redis outages or
  process crashes.
- Idempotent workers make retries safe by construction, not by careful
  case-by-case reasoning.
- The safety-net sweep provides a last-resort guarantee independent of
  BullMQ's own retry mechanism.

**Negative:**

- Every async-triggering code path needs the extra discipline of "write
  durable record, then enqueue" — easy to violate accidentally without
  code review catching it.
- The safety-net sweep needs its own scheduled job, adding a small amount
  of always-on background load.
- Slightly more latency between "event happens" and "job actually
  starts," versus a naive enqueue-only approach, since the transaction
  must commit first.

**At higher scale we would consider:**

- A genuine outbox-relay process (polling or CDC-based) decoupled from
  the request path entirely.
- Migrating to a broker with built-in durable delivery guarantees (Kafka)
  if throughput outgrows what a single Redis instance backing BullMQ can
  handle.
