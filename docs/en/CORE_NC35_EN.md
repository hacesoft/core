[🇨🇿 Česky](../cz/CORE_NC35_CZ.md) | [🇬🇧 **English**](../en/CORE_NC35_EN.md)

# Shared App Core for Nextcloud 35 — status and handoff

Core `0.18.0-dev.16` and Playground `0.18.0-dev.5` are **development candidates** for NC35 only. Local checks cannot qualify PHP, database, cache, GPS or map providers on your NAS. Older NC34 audits are historical records, not the current support policy.

Dev.6 fixes the full-source ZIP packaging: all three installer scripts are present in its top-level `scripts/` directory. Before touching Nextcloud, the installer also checks its schema and cache verification files.

## Service catalog

| Service | Public entry point | Status | Release check |
| --- | --- | --- | --- |
| Startup | `build/examples/empty-app`, `window.HcSharedAppCore` | implemented | asset loading, missing Core, teardown |
| Layout and common UI | `layout`, `workspace`, `dialogs`, `forms`, `notifications`, `picker`, `settings` | dev.4: stable shell height under pinch zoom and horizontal scroll chaining; dev.5: centered About panel on narrow phones. Locally checked. | real phone, both pan directions, soft keyboard and About panel |
| Maps, proxy/cache and GPS | `maps`, `maps.favorites` | implemented, locally tested in prior candidate | real tiles and GPS on NAS |
| Nested lists, places and sharing | `lists` | JS built and locally tested; new PHP and migrations await NC35 | migration, concurrent writes, user/group permissions |
| Editor | `editor` | built; safe preview locally tested | mobile and integration into consuming apps |
| Shared app background appearance | `background` | base implemented and locally tested | integrate existing app appearance |
| Background job lifecycle | `BACKGROUND_JOBS_EN.md` | procedure only | identify orphaned jobs on NAS |

Implemented does not mean NAS qualified or published. Core itself registers no background jobs today.


When `visualViewport.scale > 1`, `layout.observe` uses the unscaled page height (`innerHeight`) for the shell, while `metrics.viewportHeight` still reports the visible area for overlays. At scale 1, height still follows the soft keyboard. Core scroll areas let horizontal motion continue at the edge. Maps and canvases may own their gestures. See the [app layout audit](AUDIT_LAYOUT_APLIKACI_EN.md). NAS verification remains pending.

## Lists, permissions and migration

Lists are scoped by application namespace and have an owner, order (`position`), archive flag and optional `parent_id`. The migration leaves existing lists as roots and does not rewrite places. A parent must have the same namespace and owner; moving a list below itself or a descendant is rejected. The consuming app builds the tree from the returned `parent_id` fields.

Owners can manage user/group shares and move lists. `read` can read a list and its places; `edit` can change both. Parent shares apply to descendants and their places; a direct child share may extend access. Matching grants combine with `edit` taking priority. The archive flag is for app UI; the server does not currently block edits to archived lists. Deletion of an entire list is outside the current API.

```ts
const core = window.HcSharedAppCore
const list = await core.lists.create('map_places', 'Trip', 10)
const child = await core.lists.create('map_places', 'Prague', 0, list.id)
await core.lists.addPlace('map_places', child.id, {
  name: 'Prague', lat: 50.087, lon: 14.421, note: '', color: '#3388ff', position: 0,
})
await core.lists.share('map_places', list.id, 'group', 'travelers', 'read')
const places = await core.lists.places('map_places', child.id)
await core.lists.update('map_places', child.id, { parent_id: null }) // move to root
await core.lists.movePlace('map_places', child.id, places[0].id, list.id)
await core.lists.sharePlace('map_places', list.id, places[0].id, 'user', 'jane', 'edit')
const directlySharedWithMe = await core.lists.sharedPlaces('map_places')
```

Sharing one place does not expose the other places in its private list. The recipient receives its `list_id` for editing, but cannot read the whole list. Full-list recipients use `lists.list` and `lists.places`; `sharedPlaces` returns only individually shared places whose lists are otherwise inaccessible. Only the list owner manages place shares. `movePlace` works only between lists of the same owner and retains the ID and direct shares. Optional boolean `favorite` and string `icon` live in the place payload. Physical list deletion is not yet a public operation.

The first `lists.list('map_places')` copies legacy per-user `map:favorites` into an “Imported favorites” list once. Legacy JSON is retained for rollback. Subsequent writes to `maps.favorites` and `lists` are **not synchronized**. Migrate each client completely and verify imports against a backup before using the new service in production.

## Editor

```ts
const editor = core.editor.create(hostElement, {
  value: markdownFromYourApp,
  onChange: text => { draft = text },
})
const markdownToSave = editor.getValue()
editor.destroy()
```

Select text and click Bold/Italic to toggle formatting, or click with no selection to type between markers; click again after the formatted text to continue normally. Ctrl/Cmd+B and Ctrl/Cmd+I work as well. Link and image URL buttons ask for the address. Plain text uses native paste; pasted or selected PNG/JPEG/GIF/WebP images can be stored by the app via `uploadImage: async file => url`. The callback must enforce the document's permissions and return a permitted URL, for example a same-origin protected attachment. Alternatively `embedImages: true` embeds files up to 1 MiB as base64 in the Markdown itself; it makes documents large and the host page must explicitly allow `data:` in its image CSP. This is enabled only in Playground's unsaved demo. Preview constructs DOM nodes without interpreting user HTML, rejects SVG/data links and unsafe protocols. The host app owns saving, attachments, access control and versions.

## App backgrounds

```ts
const background = core.background.create(hostElement, coreSettingsUrl, 'my_app_appearance')
await background.load() // current user's settings
await background.save({ mode: 'gradient', color: '#b8dbf6' })
background.destroy()
```

Public modes are `none`, `solid`, `gradient` and `image` with a credential-free HTTPS URL. Core uses its existing `settings` service and requires an app-specific namespace. App-owned image files, permissions and exact appearance migration require source code from the consuming apps. This base service does not migrate their old preferences.

## Handoff and release gate

This is **not yet the final migration instruction** for the six apps. First qualify Core and Playground on NC35 using `NAS_NC35_EN.md`, then review those apps' source code. Apps use available public Core services when needed; their own domain logic and document storage remain app owned. Keep all user data and remove old background job registrations only by exact identity. Earlier migration and audit documents are historical input.

Planned → source implemented → built and locally tested → verified on NAS → released. JavaScript and bundles reached the third stage; the changed lists PHP and database migrations still require syntax and live NC35 checks. GitHub release requires the remaining checks.


## Optimistic concurrency (0.18.0-dev.14)
The public `core.concurrency` service standardizes the client revision/409 workflow and conflict dialog. Atomic compare-and-swap remains the consuming app's server responsibility. Core unit tests cover revision payloads, 409 recognition and dialog choices; real multi-user behavior is qualified in each consuming app.
