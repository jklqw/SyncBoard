# SyncBoard — Technical Architecture, Optimization & Security Report

- **Project:** SyncBoard (Real-Time Collaborative Whiteboard)
- **Version:** 1.0.0
- **Author:** SyncBoard contributors
- **Last Updated:** 2026-11-21

---

## 1. Executive Summary & System Scope (Phase 0)

- **Problem Statement:** Traditional whiteboards broadcast raw JSON mouse/shape events and write each
  change straight to a database. Concurrent edits overwrite one another, dragging floods PostgreSQL,
  and rendering stalls after a few hundred objects.
- **Solution:** A Yjs CRDT document is the single source of truth for durable board elements; Yjs
  Awareness carries ephemeral cursor/presence data; Redis pub/sub bridges stateless WebSocket instances;
  a four-layer Konva stage with an rbush spatial index renders only the visible viewport; PostgreSQL
  stores compacted binary CRDT snapshots rather than row-per-shape JSON.
- **Target SLAs:** < 60 ms p95 cursor sync, 60 FPS at 5,000 elements, 0 data loss under 25 concurrent
  editors.
- **ADR-001 (CRDT over JSON patches):** Yjs gives mathematical convergence under concurrent offline
  edits and user-scoped undo via UndoManager origins; JSON last-write-wins does not.
- **ADR-002 (Konva + rbush over DOM/SVG):** retained-mode canvas with four isolated layers avoids
  full-scene React reconciliations; rbush reduces viewport queries to O(log n).
- **ADR-003 (NestJS + PostgreSQL + Redis):** modular DI for guards/interceptors, stateless API and WS
  processes, relational RBAC metadata, BYTEA snapshots, pub/sub fanout and distributed rate limits.
- **UI direction:** warm architectural paper (`#FAF9F6`), white floating surfaces, hairline borders,
  restrained cobalt accent, JetBrains Mono numeric readouts, and 95% of the viewport devoted to canvas.

## 2. Domain Modeling & Persistence Architecture (Phase 1)

### Canonical element contracts

Every board element is validated with a Zod discriminated union on `type` before it can enter the
CRDT document. Shared fields are `id`, `x`, `y`, `width`, `height`, `rotation`, `zIndex`, optional
`groupId`, `style`, `locked` and `updatedAt`. Nine variants are supported: rectangle, ellipse, frame,
line, arrow, freehand, text, sticky note and image. Arrows carry optional `startBinding`/`endBinding`
(`{ elementId, anchor }`) used by smart connectors. The same schemas are imported by the NestJS DTO
validation layer and the React canvas, so an invalid shape is rejected identically on both sides.

### Fractional indexing

`zIndex` is a **string** fractional index, not an integer. Moving an element between two neighbours
produces a new string between them (e.g. `a` → `aV`, `aT`) instead of renumbering every sibling. Two
clients reordering concurrently in the CRDT therefore cannot clobber each other's ordering values.

### Relational schema

`User`, `RefreshToken`, `Board`, `BoardMember`, `BoardSnapshot`, `BoardComment` and `AuditLog` are
first-class relational models with unique constraints on `(boardId, userId)` memberships, unique
token hashes and share tokens, and composite indexes on the hot paths (`ownerId, updatedAt`,
`boardId, createdAt`, `userId, familyId`). Cascade deletes keep board-related data consistent;
audit logs use `SetNull` to preserve activity history after user deletion.

### Why BYTEA snapshots beat row-per-shape JSONB

A row-per-shape design issues an UPDATE for every drag frame and requires conflict resolution for
each field. SyncBoard instead keeps a single compacted `Y.encodeStateAsUpdate(doc)` binary in
`Board.yjsState`. Updates are accumulated in memory and flushed at most every 3 seconds (15-second
ceiling), reducing write amplification by orders of magnitude during drawing. `stateVersion` plus a
Redis lock guards eviction so two stateless instances cannot overwrite a newer snapshot. Version
history stores full binary `BoardSnapshot` rows, enabling exact point-in-time restore.

## 3. Canvas Rendering & Performance Engineering (Phase 2)

_To be completed with measured benchmarks after Commit 12._

| Element Count | Without Culling (FPS) | With RBush + Layer Isolation (FPS) | Heap Memory (MB) |
| --- | --- | --- | --- |
| 500 | _record_ | _record_ | _record_ |
| 2,000 | _record_ | _record_ | _record_ |
| 5,000 | _record_ | _record_ | _record_ |

## 4. Authentication & RBAC Enforcement (Phase 3)

_To be completed after Commit 15–17._

## 5. Real-Time Distributed Sync & Offline Resilience (Phase 4)

_To be completed after Commit 20–23._

## 6. Advanced Features Engineering (Phase 5)

_To be completed after Commit 25–28._

## 7. Security Hardening & OWASP Threat Model (Phase 6)

_To be completed after Commit 30–35._

## 8. Testing, Load Benchmarks & Production Readiness (Phase 7)

_To be completed after Commit 37–41._
