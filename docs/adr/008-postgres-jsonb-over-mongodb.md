# ADR-008: Postgres JSONB over MongoDB

**Status:** Accepted
**Date:** 2026-07-07

## Context

Some data in a social app has a flexible or evolving shape — notification
payloads differ by notification type, and future features may want
semi-structured metadata without a schema migration for every new field.
MongoDB is a common reach for "flexible schema," but this project already
commits to Postgres as the relational source of truth for everything
else.

## Decision

Use Postgres's native `JSONB` column type for flexible-payload needs,
rather than introducing MongoDB as a second general-purpose database.

## Alternatives Considered

- **MongoDB for flexible-schema entities** — rejected. Would mean
  maintaining a fourth database (alongside Postgres, Neo4j, Redis) for a
  need `JSONB` already covers, without MongoDB's own distinguishing
  advantages (document model, aggregation pipelines) actually being
  necessary here — nothing in this project needs cross-document
  aggregation or MongoDB-specific query features.
- **A fully rigid relational schema, no flexible columns anywhere** —
  rejected. Some payloads (notification metadata varying by type)
  genuinely benefit from not requiring a migration every time a new
  notification type's shape is introduced.

## Consequences

**Positive:**

- One fewer database to run, monitor, and back up.
- `JSONB` fields still live inside Postgres's transactional/ACID
  guarantees, unlike a separate MongoDB instance, which would need its
  own consistency story relative to Postgres.
- `JSONB` supports indexing (GIN indexes) for queries into the JSON
  structure when needed.

**Negative:**

- `JSONB` is less ergonomic than MongoDB's native document model for
  deeply nested, highly variable documents.
- Loses MongoDB-specific tooling and aggregation features — a low-cost
  tradeoff in practice, since this project doesn't need them anyway.

**At higher scale we would consider:**

- Revisiting only if a genuine document-database use case emerged (e.g.,
  large numbers of deeply nested, highly variable analytics-style
  documents) that `JSONB` indexing couldn't serve efficiently — not
  currently anticipated for this project's scope.
