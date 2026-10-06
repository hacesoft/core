[🇨🇿 **Česky**](README_CZ.md) | [🇬🇧 English](README.md)

# Shared App Core 0.18.0-dev.16

Společné služby pro aplikace Nextcloud 35. Technické ID: `hc_shared_app_core`. Core poskytuje jednotný layout, nástrojové lišty, dialogy, formuláře, nastavení, oznámení, Markdown editor, mapové služby, seznamy, úlohy na pozadí a nástroje pro souběžnou práci uživatelů.

## Instalace

Rozbalte celý zdrojový balíček a v jeho kořeni spusťte `sudo sh install.sh`. Součástí je sestavený runtime v `src/`, TypeScript zdroje v `build/`, instalační skripty i `uninstall.sh`. Podrobnosti a kontrola prostředí jsou v [návodu pro NAS](docs/cz/NAS_NC35_CZ.md).

## Aplikace využívající Core

Aplikace z dílny Hacesoft využívají společné služby tohoto Core:

- [Žluté lístečky](https://github.com/hacesoft/nextcloud-stickynotes/blob/main/README.md) — osobní a sdílené poznámky, úkoly a widget Dashboardu.
- [Playground](https://github.com/hacesoft/Playground) — ukázková a vývojová aplikace pro vyzkoušení služeb Core.
- [GridSight](https://github.com/hacesoft/GridSight) — přehled FVE, spotřeby, baterie a cen elektřiny.

Další připravované aplikace: Wiki, Počasí, Místa a navigace a Rodokmen. Odkazy budou doplněny po zveřejnění jejich repozitářů.

## Dokumentace

- [Služby a API](docs/cz/CORE_NC35_CZ.md)
- [Katalog služeb](docs/cz/SERVICE_CATALOG_CZ.md)
- [Úlohy na pozadí](docs/cz/BACKGROUND_JOBS_CZ.md)
- [Bezpečné nasazení](docs/cz/BEZPECNE_NASAZENI_APLIKACI.md)
- [Pravidla souběžné práce](docs/MULTI_USER_CONCURRENCY_STANDARD_CZ.md)
- [Kvalifikace Nextcloud 35](docs/QUALIFICATION_NC35_CZ.md)

## Sestavení a vydání

`sh build-release.sh` nainstaluje závislosti, provede kontroly a sestaví balíčky. Zdrojový balíček zahrnuje ukázkovou aplikaci v `build/examples/empty-app/` jako vývojovou referenci; automaticky ji neinstaluje. Runtime neobsahuje source mapy. Jedna baseline migrace definuje výchozí databázi; instalační kontrola ověřuje chybějící struktury bez mazání dat.

Tato verze je vývojové vydání. Stabilní označení vyžaduje zaznamenané provozní ověření NAS/Nextcloud 35; sestavovací skript tuto podmínku zachovává. Kód i nástroje lze vložit do GitHub repozitáře v této podobě.

Licence: [LICENSE](LICENSE).
