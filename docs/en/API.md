[🇨🇿 Česky](../cz/API.md) | [🇬🇧 **English**](../en/API.md)

# API and services

Shared frontend services are exposed through `window.HcSharedAppCore`. Confirm exact signatures against the matching published release and its API contract.

- `layout`, `workspace`, `dialogs`, `forms`, `notifications`, `picker`, `settings`: shared UI primitives.
- `editor`: Markdown editor; the host app owns persistence and access control.
- `maps`, `lists`: maps, places, hierarchical lists and sharing.
- `background`: application appearance settings and backgrounds.
- `concurrency`: revision and HTTP 409 conflict helpers; the host backend must implement atomic updates.

Consuming apps must enforce per-user authorization, validate inputs and avoid assuming access to another app's private data.
