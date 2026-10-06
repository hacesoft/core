[🇨🇿 Česky](README_CZ.md) | [🇬🇧 **English**](README.md)

# Shared App Core 0.18.0-dev.16

Shared services for Nextcloud 35 applications. Technical ID: `hc_shared_app_core`. Core provides a consistent layout, toolbars, dialogs, forms, settings, notifications, Markdown editor, maps, lists, background tasks and multi-user concurrency helpers.

## Installation

Extract the full source package and run `sudo sh install.sh` from its root. It includes prebuilt runtime in `src/`, TypeScript sources in `build/`, installer scripts and `uninstall.sh`. Read the [NAS guide](docs/en/NAS_NC35_EN.md) for environment checks.

## Applications using Core

Hacesoft applications use the shared services provided by this Core:

- [Sticky Notes](https://github.com/hacesoft/nextcloud-stickynotes/blob/main/README.md) — personal/shared notes, tasks and a Dashboard widget.
- [Playground](https://github.com/hacesoft/Playground) — a demo and development application for exploring Core services.
- [GridSight](https://github.com/hacesoft/GridSight) — PV, household consumption, battery and electricity price monitoring.

Other applications in preparation: Wiki, Weather, Places and Navigation, and Family Tree. Links will be added when their repositories are published.

## Documentation

- [Services and API](docs/en/CORE_NC35_EN.md)
- [Service catalog](docs/en/SERVICE_CATALOG_EN.md)
- [Background tasks](docs/en/BACKGROUND_JOBS_EN.md)
- [Safe deployment](docs/en/SAFE_APP_DEPLOYMENT.md)
- [Multi-user concurrency](docs/MULTI_USER_CONCURRENCY_STANDARD_EN.md)
- [Nextcloud 35 qualification](docs/QUALIFICATION_NC35_EN.md)

## Building and releases

`sh build-release.sh` installs dependencies, runs checks and builds artifacts. The source package includes `build/examples/empty-app/` as a development reference, not as an automatically installed application. Runtime artifacts exclude source maps. One baseline migration defines the initial database; installer checks fill missing structures without deleting data.

This is a development release. Stable naming requires recorded NAS/Nextcloud 35 qualification, enforced by the build script. The project can be placed in a GitHub repository as provided.

License: [LICENSE](LICENSE).
