# ADR-007: Neo4j for Graph Queries (vs. Recursive CTEs)

**Status:** Accepted
**Date:** 2026-07-07

## Context

The Graph View feature and social-recommendation queries (mutual
followers, shortest path between two users, second-degree connections
filtered by shared interest) are multi-hop graph traversals. Expressing
these in SQL means recursive CTEs, which become unreadable and slow past
2-3 hops, and have no natural way to express "shortest path" or weighted
traversal without significant custom logic.

## Decision

Maintain the social graph (`FOLLOWS` relationships) in Neo4j, dual-written
alongside the authoritative Postgres `Follow` row on every follow/unfollow
(see ADR-002). All graph-shaped queries — mutuals, shortest path,
second-degree, Graph View data — go directly to Neo4j via Cypher, never
simulated in Postgres. Direct `neo4j-driver` Cypher queries are used, no
ORM layer, to keep query intent explicit and avoid an abstraction that
would fight against graph-native query patterns.

## Alternatives Considered

- **Recursive CTEs in Postgres** — rejected. This is precisely the pain
  point that motivates using a graph database at all.
- **An in-memory graph library loaded from Postgres** — rejected. Doesn't
  scale past what fits in memory, and reimplements indexing/query
  planning Neo4j already provides.
- **Skipping graph features entirely** — rejected. The Graph View is one
  of the most visually distinctive, hard-to-fake features for this
  project; it's the entire reason to reach for Neo4j.

## Consequences

**Positive:**

- Genuinely fast multi-hop queries expressed in a handful of lines of
  Cypher instead of unreadable recursive SQL.
- Makes the Graph View possible at all.

**Negative:**

- Dual-write consistency risk with Postgres (same as ADR-002).
- A second query language (Cypher) to maintain proficiency in.
- Neo4j is a separate service to run, monitor, and back up, both locally
  and in any future deployment.

**At higher scale we would consider:**

- Neo4j AuraDB (managed) instead of self-hosting.
- A CDC pipeline from Postgres to remove the dual-write risk (same note
  as ADR-002), rather than the application dual-writing directly.
