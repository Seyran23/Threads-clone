# ADR-001: Modular Monolith over Microservices

**Status:** Accepted
**Date:** 2026-07-03

## Context

Threads-clone is a solo-developer portfolio project built alongside an
existing project, MiniBank, which already demonstrates a microservices
architecture — service boundaries, inter-service communication, distributed
transactions. Threads-clone needs to prove different things: schema design
under real product complexity, real-time systems, hard query patterns (social
graph traversal, feed generation), and frontend polish. There is no team to
coordinate across services and no operational need (yet) to scale
components independently.

## Decision

Build Threads-clone as a modular monolith: a single deployable NestJS
application, organized into `modules/` (feature capabilities), `common/`
(cross-cutting concerns), and `infrastructure/` (adapters to Postgres,
Neo4j, Redis, S3). Module boundaries are enforced by folder structure and
import discipline, not by network calls.

## Alternatives Considered

- **Microservices** (per-domain services: auth-service, posts-service,
  feed-service, etc.) — rejected. This is what MiniBank already proves;
  repeating it here demonstrates the same skill twice instead of a
  different one, and adds operational overhead (service discovery,
  inter-service auth, distributed transactions) with no team or scaling
  need to justify it.
- **Serverless functions** (a function per route) — rejected. Doesn't fit
  long-lived stateful connections needed for Socket.io, and fragments the
  BullMQ worker model across cold-start boundaries.

## Consequences

**Positive:**

- Single codebase, single deploy pipeline, single docker-compose stack for
  local dev.
- No network calls between modules — all in-process, so transactions can
  span module boundaries freely via Prisma's `$transaction`.
- Simpler to reason about failure modes than a distributed system.

**Negative:**

- Can't scale individual modules independently.
- A severe bug in one module can affect the whole process's uptime.
- Module boundaries are a discipline, not a hard enforcement — nothing
  stops a future contributor from reaching across them except code review
  and the folder-structure convention.

**At higher scale we would consider:**

- Extracting the feed-fanout worker and notification-delivery worker into
  separately deployable processes first — they have a distinct scaling
  profile (CPU/IO-bound background work) from the HTTP API — before ever
  considering a fuller microservices split.
