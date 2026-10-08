[🇨🇿 Česky](../README_CZ.md) | [🇬🇧 English](../README.md)

# Multi-user changes and optimistic concurrency

Applies from **Shared App Core 0.18.2**.

This contract protects a shared object when two users or two browser tabs load the same revision and later both try to save it. It is not presence, collaborative editing, or a long-lived mutex.

## Required server contract

Every shared mutable object must expose a stable revision. Prefer a non-negative integer `revision` incremented exactly once for every successful mutation.

A client sends the revision it edited as `expectedRevision`. The server must perform an atomic compare-and-swap operation, for example:

```sql
UPDATE app_table
SET title = ?, revision = revision + 1
WHERE id = ? AND revision = ?
```

Zero changed rows means the object was changed or removed meanwhile. Return **HTTP 409 Conflict** and do not overwrite the newer state. A separate `SELECT` followed by an unconditional `UPDATE` is not sufficient.

The same revision protects all mutations of the object, including secondary fields such as tree placement, pinning, permissions, or deletion.

## Public Core client service

Use `window.HcSharedAppCore.concurrency`:

```js
const payload = core.concurrency.withExpectedRevision({ title, content }, page.revision)

try {
  const saved = await savePage(payload)
  page.revision = saved.revision
} catch (error) {
  if (!core.concurrency.isConflict(error)) throw error

  const choice = await core.concurrency.resolveConflict({
    title: 'Edit conflict',
    message: 'Another user or tab changed this item while you were editing it.',
    reloadLabel: 'Load newer version',
    keepEditingLabel: 'Keep my changes',
    compareLabel: 'Compare',          // optional
    saveCopyLabel: 'Save as copy',   // optional
  })
}
```

Public methods:

- `withExpectedRevision(payload, revision)` returns a new payload with `expectedRevision` and does not mutate the source object.
- `getStatus(errorOrResponse)` extracts an HTTP status from common error shapes.
- `isConflict(errorOrResponse)` recognizes HTTP 409.
- `resolveConflict(options)` shows the common Core dialog and resolves to `reload`, `keep-editing`, and optionally `compare` or `save-copy`.

Core is the final shared **client and UX contract**. It is not a central database lock. The consuming app remains responsible for the atomic server-side revision check.

## Required consumer tests

At minimum: two clients load revision 10; client A saves and gets 11; client B saves with `expectedRevision=10`; the server returns 409 without a partial write; after reloading revision 11, B can save. Repeat the same scenario for at least one secondary mutation such as tree movement or ACL changes.


## Live synchronization of an open object

Since `0.18.2`, consumers may use `core.concurrency.watchRevision(...)`. This is lightweight revision polling, not a lock or realtime transport. The default interval is 2 seconds; polling pauses while the tab is hidden and an immediate check runs on visibility/focus return. Consumers should poll a small revision/state endpoint and fetch the full object only when the revision changes. Server-side CAS remains authoritative.
