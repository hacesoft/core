[🇨🇿 Česky](README_CZ.md) | [🇬🇧 **English**](README.md)

# Shared App Core 0.18.1

Shared services for Nextcloud 35 applications. Technical ID: `hc_shared_app_core`. Core provides a consistent layout, toolbars, dialogs, forms, settings, notifications, Markdown editor, maps, lists, background tasks and multi-user concurrency helpers.

## Installation

Extract the full source package and run `sudo sh install.sh` from its root. It includes prebuilt runtime in `src/`, TypeScript sources in `build/`, installer scripts and `uninstall.sh`. Read the [NAS guide](docs/en/NAS_NC35_EN.md) for environment checks.

## Applications using Core

Hacesoft applications use the shared services provided by this Core:

- [Sticky Notes](https://github.com/hacesoft/nextcloud-stickynotes/blob/main/README.md) — personal/shared notes, tasks and a Dashboard widget.
- [Playground](https://github.com/hacesoft/Playground) — a demo and development application for exploring Core services.
- [GridSight](https://github.com/hacesoft/GridSight) — PV, household consumption, battery and electricity price monitoring.
- [Weather](https://github.com/hacesoft/Weather) — current weather, forecasts, radar and ALADIN map layers.
- [Places and Navigation](https://github.com/hacesoft/Places-and-Navigation) — saved and shared places, maps and navigation handoff.

Other applications in preparation: Wiki, Weather, Places and Navigation, and Family Tree. Links will be added when their repositories are published.

## Documentation

- [Application and Core version checks](docs/UPDATE_CHECK_EN.md)
- [Services and API](docs/en/CORE_NC35_EN.md)
- [Service catalog](docs/en/SERVICE_CATALOG_EN.md)
- [Background tasks](docs/en/BACKGROUND_JOBS_EN.md)
- [Safe deployment](docs/en/SAFE_APP_DEPLOYMENT.md)
- [Multi-user concurrency](docs/MULTI_USER_CONCURRENCY_STANDARD_EN.md)
- [Nextcloud 35 qualification](docs/QUALIFICATION_NC35_EN.md)

## Building and releases

`sh build-release.sh` installs dependencies, runs checks and builds artifacts. The source package includes `build/examples/empty-app/` as a development reference, not as an automatically installed application. Runtime artifacts exclude source maps. One baseline migration defines the initial database; installer checks fill missing structures without deleting data.


License: [LICENSE](LICENSE).

## Application localization

Core is a shared service and does not have a separate complete set of 11 locale catalogs. Some components receive translations from the host app (for example the editor’s `translate` callback); other text keeps the component default language. Host applications must describe their own language support in their guides. Core documentation is available in Czech and English.

Every future app update must audit the shared language set: `cs`, `en`, `de`, `es`, `fr`, `it`, `nl`, `pl`, `pt`, `sk`, `uk`. Add missing languages and translation keys, verify Nextcloud language selection, and document the languages actually supported. A catalog file alone does not prove translation completeness. User guides and development documentation are published only in Czech and English.

See the [localization policy](docs/LOCALIZATION_POLICY_EN.md).
