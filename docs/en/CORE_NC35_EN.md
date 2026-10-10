[🇨🇿 Česky](../../README_CZ.md) | [🇬🇧 English](../../README.md)

# Shared App Core for Nextcloud 35 — status and handoff

Core `0.18.4` provides shared services for Hacesoft applications on Nextcloud 35. The installation package includes prebuilt runtime and source code.

Dev.6 fixes the full-source ZIP packaging: all three installer scripts are present in its top-level `scripts/` directory. Before touching Nextcloud, the installer also checks its schema and cache verification files.

## Service catalog

| Service | Public entry point |
| --- | --- |
| Startup | `build/examples/empty-app`, `window.HcSharedAppCore` |
| Layout and common UI | `layout`, `workspace`, `dialogs`, `forms`, `notifications`, `picker`, `settings` |
| Maps, proxy/cache and GPS | `maps`, `maps.favorites` |
| Nested lists, places and sharing | `lists` |
| Editor | `editor` |
| Shared app background appearance | `background` |
| Background job lifecycle | `BACKGROUND_JOBS_EN.md` |


## Lists, permissions and migration

Lists are scoped by application namespace and have an owner, order (`position`), archive flag and optional `parent_id`. Existing lists without a parent remain roots; places are not rewritten. A parent must have the same namespace and owner; moving a list below itself or a descendant is rejected. The consuming app builds the tree from the returned `parent_id` fields.

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


## Optimistic concurrency (0.18.4)
The public `core.concurrency` service standardizes the client revision/409 workflow and conflict dialog. Atomic compare-and-swap remains the consuming app's server responsibility. Core unit tests cover revision payloads, 409 recognition and dialog choices; real multi-user behavior is qualified in each consuming app.
