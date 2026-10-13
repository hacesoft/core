[🇨🇿 Česky](../cz/DEVELOPMENT.md) | [🇬🇧 **English**](../en/DEVELOPMENT.md)

# Developing applications using Core

Core exposes shared services through the public `window.HcSharedAppCore` interface. Check that Core is available and its contract version is compatible before mounting your UI.

The reference application is available in `build/examples/empty-app/`; shared frontend TypeScript lives in `build/frontend/`. Production app installations do not need these build tools.

Service areas include layout, workspace, dialogs, forms, notifications, settings, Markdown editor, maps, lists, sharing and concurrency helpers. Consuming apps remain responsible for storage, authorization and APIs. Do not rely on Core's internal database tables as a public interface.

```js
const core = window.HcSharedAppCore
if (!core) throw new Error('Shared App Core is required')
// Initialize only the services your application uses.
```

See [API and services](API.md) for lists and sharing details.

## Detailed developer references
- [Core integration and contracts](CORE_REFERENCE.md)
- [Public services catalog](SERVICES.md)
- [Background jobs](BACKGROUND_JOBS.md)
- [Concurrent edits and conflicts](CONCURRENCY.md)
