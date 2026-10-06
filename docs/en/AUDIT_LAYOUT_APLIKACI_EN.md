[🇨🇿 Česky](../cz/AUDIT_LAYOUT_APLIKACI_CZ.md) | [🇬🇧 **English**](AUDIT_LAYOUT_APLIKACI_EN.md)

# Mobile layout audit · 26 September 2026

This review uses source packages supplied by 26 September and the GridSight 0.8.0-dev.6 fix. It is a source review with local Core tests, not a phone or NAS qualification. The currently deployed files on the NAS have not been compared yet.

## Shared cause

Core 0.18.0-dev.3 used `visualViewport.height` for the whole app shell. Pinch zoom shrinks the visible viewport, so the shell could shrink and expose a strip of background below it. `overscroll-behavior: contain` on the common scroll area also stopped horizontal movement from continuing at its edge. Core 0.18.0-dev.5 uses `window.innerHeight` for **shell height** when `visualViewport.scale > 1` and lets horizontal scrolling continue at the edge. `metrics.viewportHeight` still reports the visible viewport for overlays; normal scale still follows the soft keyboard.

| App and reviewed version | Source finding | Phone check |
| --- | --- | --- |
| Playground 0.18.0-dev.5 | Uses the public Layout API. The user has confirmed zoom and panning in its example UI on a PC. This Core change does not alter the app. | Check pinch zoom and both pan directions on a phone. |
| Weather 0.17.7 → 0.17.8 | The final `#wp-app.wp-app` rule takes shell height from Core and overrides an earlier stable `svh` mobile rule. Its scroll area reinstated `overscroll-behavior: contain`; dev.8 permits horizontal chaining. The map owns its gestures. | Zoom the overview outside the map and pan in both directions; separately test map pan and zoom. |
| Sticky Notes 2.0.7 | One-column mobile board, its own main content scroller, and dialogs sized to the visible viewport. Its shell uses Core. No equivalent late five-column grid was found. | Zoom the board and a long note; check page and dialog scrolling. |
| Wiki 0.3.6-dev.1 | Mobile sidebar collapses, long content wraps, and the root height uses Core's `--hc-shared-app-core-available-height`. | Zoom a long page, open the sidebar, and insert a wide table. Page creation is a separate functional test. |
| Family Tree 0.8.1-dev.2 → dev.3 | Mobile panels collapse. The wide tree intentionally scrolls inside its canvas; `overscroll-behavior: contain` stopped horizontal movement at the canvas edge. Dev.3 changes only the X axis. | Zoom a large tree, pan to its edge and back, then inspect a modal form. |
| Navigation 0.9.13-dev.1 | Root height comes from Core; the map owns gestures and the list has a separate mobile panel. No GridSight-style five-column overflow was found. | Test map, search and list after pinch zoom; map panning remains independent. |
| GridSight 0.8.0-dev.6 | Its late five-column climate rule was fixed in the app. The shell already has stable height and horizontal chaining. | Check temperatures, the SPOT amount, and both pan directions on a real phone. |

**Status:** The shared cause is fixed and locally tested in Core. Weather and Family Tree have focused CSS changes. This audit does not qualify the remaining apps in production. Record exact installed NAS versions and any other overflowing widgets found with real data.
