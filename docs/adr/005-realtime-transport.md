# ADR-005: Real-Time Transport

**Status:** Accepted
**Date:** 2026-07-07

## Context

New posts from followed accounts, notifications, and live like/reply
counts need to reach connected clients without polling. A single
Socket.io server instance is simple but doesn't scale horizontally — a
client connected to instance A never receives an event emitted from
instance B, so multi-instance deployment silently breaks real-time
delivery unless something bridges the instances.

## Decision

Socket.io with the Redis adapter. The Redis adapter turns Socket.io's
`emit` into a pub/sub broadcast through Redis, so an event emitted from
any server instance reaches sockets connected to any other instance.
Real-time delivery is best-effort — the underlying data (notification,
feed entry) always lives durably in Postgres/Redis regardless, so a
missed real-time event means the client catches up on its next fetch, not
lost data.

## Alternatives Considered

- **Plain WebSockets with a custom pub/sub layer** — rejected. Reinvents
  what Socket.io and its Redis adapter already do well (reconnection
  handling, room/namespace support, transport fallback).
- **Server-Sent Events (SSE)** — rejected. One-directional only; this
  project also needs client-to-server real-time signals (presence
  heartbeats), so bidirectional WebSockets fit better.
- **A managed real-time service** (Pusher, Ably) — rejected. Adds an
  external paid dependency and a third-party data path for a project
  whose point is demonstrating this can be built directly.

## Consequences

**Positive:**

- Horizontal scaling of the socket layer is solved from day one, not
  bolted on later.
- Socket.io's client library handles reconnection and transport fallback
  transparently.

**Negative:**

- Redis serves double duty as both cache and pub/sub bus, adding load to
  the same instance — acceptable at this project's scale, worth
  monitoring if that changes.
- A dropped real-time event is silently lost unless the client
  independently re-fetches. The system deliberately does **not**
  guarantee real-time delivery, only eventual consistency via normal data
  fetches.

**At higher scale we would consider:**

- A dedicated pub/sub broker (e.g., NATS) separate from the Redis
  instance backing feed cache and rate limiting, isolating socket
  fan-out load from other Redis responsibilities.
