[🇨🇿 Česky](../README_CZ.md) | [🇬🇧 English](../README.md)

# Shared App Core runtime qualification on NC35

**This is the current qualification procedure for the Core 0.18.x line.** Core `0.18.2` declares Nextcloud 35 only (`min-version=35`, `max-version=35`). NC34 is not a supported test target for this version.

Use a restorable NC35 test environment, record the exact Nextcloud/PHP/database/Redis build, install without force-enable, and keep a code/database/config/data backup. Local JS/PHP checks do not replace runtime qualification.

For isolated PHP checks from the full-source root:

```sh
sh build/scripts/qualify-container.sh nextcloud-test35 35 8.5
```

Set the third argument to the actual PHP major.minor version. The script does not install the package.

The runtime matrix must verify installation/upgrade, `/status` with `nextcloud.min=35` and `nextcloud.max=35`, startup/BFCache, layout, editor, concurrency, maps/cache/location, settings/sharees, favorites, CSRF and web/cron deployment. Record every result explicitly; **NOT RUN is never PASS**.

