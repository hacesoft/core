[🇨🇿 Česky](../README_CZ.md) | [🇬🇧 English](../README.md)

# Shared App Core — vstupní dokument

Pracovní kandidát **0.18.0-dev.16**, cílový rozsah **NC35**. Nejde o vydanou ani provozně ověřenou podporu NC35. Produkční základ zůstává 0.17.0. Aktuální provozní brána: [QUALIFICATION_NC35_CZ.md](QUALIFICATION_NC35_CZ.md). Historický audit je zachován odděleně.

| Oblast | Autoritativní dokument |
|---|---|
| Závazný standard / Core Guard | [START_APLIKACE_CZ.md](START_APLIKACE_CZ.md) |
| Migrační playbook existující aplikace | [MIGRACE_APLIKACE_CZ.md](MIGRACE_APLIKACE_CZ.md) |
| Přechod NC34 → NC35 | [MIGRATION_NC35_FOR_APPS_CZ.md](MIGRATION_NC35_FOR_APPS_CZ.md) |
| Služby a veřejné API | [SERVICE_CATALOG_CZ.md](SERVICE_CATALOG_CZ.md) |
| Editor / jednotný Markdown renderer | [EDITOR_RENDERING_CZ.md](EDITOR_RENDERING_CZ.md) |
| Multi-user souběh | [MULTI_USER_CONCURRENCY_STANDARD_CZ.md](MULTI_USER_CONCURRENCY_STANDARD_CZ.md) |
| Release artefakty / source mapy | [RELEASE_ARTIFACT_POLICY_CZ.md](RELEASE_ARTIFACT_POLICY_CZ.md) |
| Layout | [LAYOUT_API_CZ.md](LAYOUT_API_CZ.md) |
| Mapy, cache, poskytovatelé | [MAPS_API_CZ.md](MAPS_API_CZ.md) |
| GPS a následování | [MAPS_LOCATION_CZ.md](MAPS_LOCATION_CZ.md) |
| Diagnostika | [FAQ_TROUBLESHOOTING_CZ.md](FAQ_TROUBLESHOOTING_CZ.md) |
| Provozní ověření aktuálního kandidáta na NC35 | [QUALIFICATION_NC35_CZ.md](QUALIFICATION_NC35_CZ.md) |

Staré názvy ZAVAZNY_STANDARD_APLIKACE_CZ.md, CORE_GUARD_CZ.md a PRAVIDLA_INTEGRACE_APLIKACI_CZ.md nejsou v základu 0.17.0 samostatnými dokumenty. Nahrazuje je START_APLIKACE_CZ.md a MIGRACE_APLIKACE_CZ.md; starý dynamický Guard se nepřebírá. Tato mapa zabraňuje vzniku více odlišných předpisů.



### Concurrency 0.18.0-dev.14
Pro víceuživatelské editace používejte veřejné `core.concurrency` a závazný serverový CAS postup z `MULTI_USER_CONCURRENCY_STANDARD_CZ.md`.

### Release artefakty (od 0.18.0-dev.11)
Canonical build nevytváří source mapy. `*.map` a `sourceMappingURL` jsou zakázané release gate; viz `RELEASE_ARTIFACT_POLICY_CZ.md`.


### Support-range invariant
Aktuální kandidát je **NC35-only**. `info.xml`, `Application::NEXTCLOUD_MIN/MAX`, `/status`, empty-app, kvalifikační skripty a aktivní dokumentace musí vždy uvádět stejný rozsah. Historické NC34 texty patří pouze do `docs/archive/`.
