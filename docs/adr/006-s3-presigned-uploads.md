# ADR-006: S3 Presigned Uploads

**Status:** Accepted
**Date:** 2026-07-07

## Context

Users upload images for posts. Routing every upload through the NestJS
backend (receive file → validate → stream to S3) means the backend spends
time and memory on every upload's raw bytes, doubling network transfer
(client→backend, backend→S3) and creating a scaling bottleneck for
anything upload-heavy.

## Decision

The backend never touches image bytes. `POST /media/presign-upload` issues
a short-lived (10-minute) presigned S3 `PutObject` URL, scoped to an exact
key, content-type, and content-length — the content-length is signed as
part of the request, so a client uploading a different-sized file than it
declared gets rejected by S3 itself (`403 SignatureDoesNotMatch`), not
just trusted client-side. The browser then uploads directly to S3/MinIO
using that URL — the backend is not involved in the transfer at all. A
background BullMQ worker later downloads the original server-side (for
thumbnail generation only) and re-uploads just the thumbnail.

## Alternatives Considered

- **Backend-proxied upload** (multipart form to NestJS, backend streams to
  S3) — rejected. Doubles bandwidth cost and ties up backend
  request-handling capacity for the duration of every upload, for no
  correctness benefit.
- **Client uploads with long-lived, broadly-scoped credentials** (e.g., a
  shared IAM key baked into the frontend) — rejected. A hard security
  anti-pattern; presigned URLs scope exactly one operation (`PUT` this
  exact key) for a short window, using credentials that never leave the
  server.
- **Signed POST policies instead of presigned PUT** — considered, not
  chosen. Presigned `PUT` with an explicit `Content-Length` is simpler to
  implement and sufficient for enforcing size limits, without needing the
  more complex POST-policy condition syntax.

## Consequences

**Positive:**

- The backend never becomes an upload bottleneck.
- Size and content-type limits are enforced by S3's own signature check,
  not merely trusted from the client.
- Upload volume scales entirely as S3's problem, not ours.

**Negative:**

- A client can request a presigned URL and never actually upload
  anything, leaving no application-level record at all — mitigated by
  relying on an S3 bucket lifecycle rule to expire untagged/unreferenced
  objects, not application code.
- The backend can't inspect uploaded bytes until the async worker
  downloads them later, so confirming the file is genuinely a
  well-formed image happens after the fact, not at upload time — an
  explicit, accepted tradeoff (the image-processing worker's `sharp`
  decode step is effectively the first real content validation, and it
  runs with an explicit pixel-count ceiling to guard against malformed
  or adversarial input).

**At higher scale we would consider:**

- A CDN in front of the bucket (CloudFront) for read traffic.
- S3 Event Notifications triggering the thumbnail job directly instead of
  our own BullMQ enqueue call on post creation, removing the
  "did the client actually finish uploading" ambiguity entirely.
