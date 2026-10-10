[🇨🇿 Česky](../cz/SERVICE_CATALOG_CZ.md) | [🇬🇧 **English**](SERVICE_CATALOG_EN.md)

# Public service catalog

The authoritative NC35 implementation and qualification status is in [Core NC35](CORE_NC35_EN.md). The public entry point is `window.HcSharedAppCore` (API version 1). It exports `version`, `apiVersion`, `assertCompatible`, `events`, `config`, `logger`, `workspace`, `layout`, `dialogs`, `notifications`, `toolbar`, `forms`, `settings`, `picker`, `about`, `updates`, `maps`, `lists`, `editor`, `background`, and `concurrency`. Use a public Core service wherever an app needs that shared behavior.

Types live in `build/frontend/index.ts`, `lists.ts`, `editor.ts`, `background.ts` and `concurrency.ts`. The complete startup example is in `build/examples/empty-app/`. Document storage and permissions remain in the hosting app. List PHP/migrations and the editor still need qualification on the NAS. 

Required installer standard for each application: [safe deployment into `custom_apps`](SAFE_APP_DEPLOYMENT.md). The template includes `scripts/custom-apps-safety.sh` to move old duplicate trees before calling `occ`.


## Concurrency — shared client contract 0.18.4

`core.concurrency` standardizes the client side of optimistic concurrency. `withExpectedRevision(payload, revision)` adds `expectedRevision`, `isConflict(...)` recognizes HTTP 409, `mergeText(base, local, remote)` conservatively merges non-overlapping text changes, and `resolveConflict(...)` opens the shared conflict dialog. Core does not replace the consuming app's atomic compare-and-swap update. See `../MULTI_USER_CONCURRENCY_STANDARD_EN.md`.
