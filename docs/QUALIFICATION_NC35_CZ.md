[🇨🇿 Česky](../README_CZ.md) | [🇬🇧 English](../README.md)

# Provozní kvalifikace Shared App Core na NC35

**Toto je jediný aktuální kvalifikační postup pro řadu Core 0.18.x (NC35-only).** Core `0.18.4` deklaruje v `info.xml` pouze Nextcloud 35 (`min-version=35`, `max-version=35`). NC34 není podporovaný testovací cíl tohoto balíčku.

## Prostředí

1. Použijte oddělenou nebo obnovitelnou kopii skutečného NC35 prostředí. Zaznamenejte přesnou verzi Nextcloudu, PHP, databáze, Redis a image/digest.
2. Nainstalujte balíčku běžným způsobem. Nepoužívejte force-enable a neměňte `info.xml`.
3. Před testem uchovejte zálohu kódu, DB, configu a dat.
4. Lokální JS/PHP kontroly nejsou náhradou za runtime test na NC35.

## Izolované PHP kontroly

Z kořene full-source balíku lze proti testovacímu NC35 kontejneru spustit:

```sh
sh build/scripts/qualify-container.sh nextcloud-test35 35 8.5
```

Třetí argument nastavte na skutečnou major.minor verzi PHP testovacího kontejneru. Skript balíčku neinstaluje; ověřuje verze, OCC stav, PHP syntax a izolované nativní testy.

## Runtime matice NC35

| Scénář a očekávaný výsledek | NC35 |
|---|---|
| Instalace/upgrade bez ztráty nastavení, klíčů, favorites a cache | NEPROVEDENO |
| `/status`: HTTP 200, `no-store`, správný app/contract/API, `nextcloud.min=35`, `nextcloud.max=35`, `version=installedVersion=frontend` | NEPROVEDENO |
| Playground/reference start; Core CSS; reload; BFCache; žádný dvojí mount | NEPROVEDENO |
| Chybějící nebo starší Core bezpečně zastaví spotřebitele | NEPROVEDENO |
| Layout: mobil, desktop, pinch zoom, oba směry scrollu, orientace, split-screen | NEPROVEDENO |
| Dialogy, toolbar, forms, picker, notifications, settings read/write | NEPROVEDENO |
| Editor: write/preview/render a aplikační rozšíření rendereru | NEPROVEDENO |
| Concurrency: revision/CAS, HTTP 409, reload, safe merge nekolizních textových změn | NEPROVEDENO |
| About/Updates nezablokuje start při nedostupném upstreamu | NEPROVEDENO |
| GPS watch/follow: souhlas/odmítnutí/timeout, pan off, zoom, stop/destroy | NEPROVEDENO |
| Map providers, key validation, Redis runtime, cache hit/miss a paralelní fetch | NEPROVEDENO |
| Favorites CRUD a izolace účtů | NEPROVEDENO |
| Sharees picker neobchází oprávnění; non-admin nemění provider/config/cache | NEPROVEDENO |
| URL v podadresáři, CSRF, web/cron sdílený strom, log bez nových chyb | NEPROVEDENO |

Browser smoke skript `build/tests/browser/nc35-qualification.js` musí přijmout jen `/status` s rozsahem 35–35.

U každého runtime testu zaznamenejte datum, přesný build NC/PHP/Core a výsledek. **NEPROVEDENO se nikdy nepovažuje za PASS.**

## Lokální reprodukce

```sh
cd build
npm ci
npm run check
npm run build
```

Tyto testy ověřují zdrojový kontrakt a build, nikoli skutečný NAS runtime.

