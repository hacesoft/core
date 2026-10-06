[🇨🇿 Česky](../cz/BACKGROUND_JOBS_CZ.md) | [🇬🇧 **English**](../en/BACKGROUND_JOBS_EN.md)

# Background jobs during the NC35 migration

Core currently registers no background jobs. Each consuming app owns its installation, upgrade, disable and uninstall lifecycle. NC35 supports registrations in `info.xml` on install/update, and `IJobList::add`/`remove` for parameterized jobs ([NC35 developer guide](https://docs.nextcloud.com/server/stable/developer_manual/basics/backgroundjobs.html)).

1. Back up the database. Record exact class, ID and arguments with `sudo docker exec -u www-data nextcloud-app php occ background-job:list`.
2. Compare any suspected Notes or GridSight entry with the log and the app source. Do not remove jobs based on a partial name match.
3. When renaming a class/app, keep the old class loadable through the targeted migration, call `IJobList::remove(OldClass::class, $arguments)` and register the replacement once. Verify repeated upgrades.
4. If the class is already missing, inspect the exact entry, then run `sudo docker exec -u www-data nextcloud-app php occ background-job:delete ID`. The command displays details and asks for confirmation. Never wipe the background jobs table ([NC35 admin guide](https://docs.nextcloud.com/server/stable/admin_manual/occ_system.html#background-job-delete)).
5. After disabling, compare the job list and log across another cron cycle; test reactivation and uninstall. Clean up registrations before deleting app code, while preserving user documents.

A check inside `run()` cannot fix a missing PHP class. For each consuming app, test fresh install, repeat install/upgrade, disable, cron cycle, re-enable, uninstall and old-class migration. A precise fix for Notes or GridSight needs their current source, job list and relevant log lines.
