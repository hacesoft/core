[🇨🇿 Česky](../cz/BEZPECNE_NASAZENI_APLIKACI.md) | [🇬🇧 **English**](SAFE_APP_DEPLOYMENT.md)

# Required rule: `custom_apps` contains live applications only

Each of our applications may have only one live directory in `/var/www/html/custom_apps`, named exactly after its `<id>` in `appinfo/info.xml`. Working trees named `app.new.*`, `app.old`, `app.backup*` or `app.tmp*` must remain outside this tree. Nextcloud also scans extra directories under `custom_apps`; a second valid manifest with the same App ID can block `occ upgrade`.

Before its **first `occ` command**, each installer loads `scripts/custom-apps-safety.sh`. It scans both web and cron containers and moves leftover copies of our applications outside `custom_apps` without deleting them, to `<datadirectory>/hc-core-deployment-backups/custom-apps-quarantine/`. If another application lacks a canonical live directory, it refuses to move its only copy. Successful moves show a warning and the retained backup location. Third-party applications are not changed.

Incoming files are copied and validated in private `/tmp/<app>.install.<pid>` directories; any `*.new.<pid>` working copy also stays in `/tmp`. Previous application code is backed up in the Nextcloud data directory or another directory outside `custom_apps`. Only verified content is moved into the single canonical live path. EXIT traps remove precisely identified temporary paths, leaving backup copies and user data intact. This rule covers `install.sh`, any later `update.sh`, a separate cron application mount, and the `build/examples/empty-app/` template.

To inspect directory names and declared IDs without changing anything:

```sh
sudo docker exec nextcloud-app sh -c 'for d in /var/www/html/custom_apps/*; do [ -f "$d/appinfo/info.xml" ] || continue; printf "%s -> " "${d##*/}"; sed -n "s:.*<id>\\([^<]*\\)</id>.*:\\1:p" "$d/appinfo/info.xml" | head -n 1; done'
```

The duplicate application tree problem is separate from Nextcloud Talk's `tta_throom_attendee` database index issue. These application installers do not modify that index.
