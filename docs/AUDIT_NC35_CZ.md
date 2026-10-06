[🇨🇿 Česky](../README_CZ.md) | [🇬🇧 English](../README.md)

# HISTORICKÝ AUDIT – DEV.1, NE AKTUÁLNÍ SUPPORT KONTRAKT

> Tento dokument zachovává auditní stopu původního přechodu, kdy se zvažoval rozsah NC34–NC35. Aktuální Core 0.18.0-dev.16 je NC35-only. Pro aktuální kvalifikaci použijte `QUALIFICATION_NC35_CZ.md`.

# Audit přípravy Core na NC35

Datum: 21. 9. 2026. Výchozí Core a Playground 0.17.0. Vývojový kandidát: **0.18.0-dev.1**. Návrh stabilní verze: **0.18.0**, API 1. **Stabilní verze není vydána.**

## Rozsah a důkazy

Byly porovnány tři dodané podklady: runtime `hc_shared_app_core-0.17.0-current.zip`, full-source Core 0.17.0 a full-source Playground 0.17.0. Soubory produkčního runtime odpovídají stromu src full-source balíku. Audit zahrnul všechny existující docs, frontend, PHP src, instalační/uninstall/build skripty, manifesty, empty-app a testy. Spotřebitelské aplikace nebyly změněny. NAS nebyl připojen ani aktualizován.

Staré názvy Guard/standard dokumentů už v základu nejsou; autoritativními náhradami jsou START_APLIKACE_CZ.md a MIGRACE_APLIKACE_CZ.md. Přehled náhrad je v START_HERE_CZ.md. Historický release 0.17.0 zůstává označený jako historie.

## Nalezené nesrovnalosti a změny kandidáta

| Nález | Provedené opatření |
|---|---|
| Metadata a runtime /status hlásily pouze NC34 | info.xml Core, Playground, empty-app má cílový rozsah 34–35; Application::NEXTCLOUD_MIN/MAX je jediný PHP zdroj rozsahu; status jej používá |
| Podpora NC35 není provozně ověřena | Přípona dev.1, upozornění README/Playground, status qualification=pending-nc34-nc35-runtime; stable balení blokované do revize kvalifikace |
| Staré titulky dokumentace 0.16.1, více historických předpisů | Jeden současný index, jeden startovací dokument; startup bloky jsou doslovně kontrolované proti referenci |
| Příklad layoutu a empty-app ničily controllery i při BFCache | Cleanup přeskočí persisted=true; skutečný unload je uklidí. Playground tento princip už používal |
| Reference/Playground nekontrolovaly API major | Kontrola apiVersion proti requiredApiVersion manifestu před assertCompatible(minimumString) |
| Composer cesty po přesunu do build nesměřovaly na runtime | PSR-4 na ../src/lib, samostatný lint skript s propagací selhání |
| Přímé spuštění PHP cache testu mělo chybnou relativní cestu | Oprava default source na ../../../src; instalátor dál předává explicitní HC_CORE_TEST_SOURCE |
| Pomocná kontrola závislosti předpokládala hostitelské PHP | Čtení JSON a version_compare uvnitř Nextcloud kontejneru |
| Nezjištěná NC verze mohla projít instalátorem | Core, Playground i reference při prázdné verzi skončí před nasazením |

Veřejná identita se nemění: app ID hc_shared_app_core, PHP OCA\HcSharedAppCore, JS window.HcSharedAppCore, contract hc-shared-app-core-v1, manifest appinfo/hc_shared_app_core.json. Žádná doménová migrace dat ani nový mapový cache formát. PHP minimum zůstává 8.2 kvůli NC34; samotný NC35 vyžaduje alespoň8.3. Bez závislostí na phpseclib a Symfony v Composeru Core.

## NC35 Critical Changes — výsledek kontroly zdrojů

Podklad: kompletní [oficiální Critical Changes](https://docs.nextcloud.com/server/stable/developer_manual/release_notes/critical_changes.html), nikoli jen vybrané body uživatele. Následující výsledky N/A znamenají nenalezené používání v Core, ne potvrzení všech spotřebitelů.

| Kontrola | Nález v Core / Playground / referenci |
|---|---|
| Symfony Console7, execute():int | N/A: žádné vlastní OCC commandy; install spouští existující OCC |
| phpseclib2 →3 | N/A: žádný import ani Composer dependency |
| OCP DB schema wrappers, Column setOptions/setType, Type lookup | N/A pro schémata: Core nemá Doctrine schema migrace. Migrační příklad používá veřejný QueryBuilder; žádné odstraněné schémové API |
| Remote rozhraní | N/A: žádná z odstraněných OCP\Remote vazeb |
| IPreview::registerProvider | N/A: Core neregistruje preview provider |
| Calendar Resource/Room manager | N/A: nepoužívá se |
| AutoCompleteEvent | N/A: vlastní sharees endpoint, ne odstraněný event |
| IRootFolder hook emitter | N/A: není dědění/registrace OC\Hooks\Emitter |
| Podepsaná federace | N/A: Core neposkytuje federation provider |
| Odstraněné JS aliasy a knihovny | V runtime zdrojích nejsou oc_* aliasy, OCDialogs, moment, _, dav ani ClipboardJS |
| DB server / dotazy | MariaDB10.11.19 splňuje uvedené minimum; žádné vlastní SQL GROUP BY aliasy ani MD5 funkce nalezeny |
| Unified sharing | Oficiální kapitola je zatím nehotová; nevytváříme nový API slib. Core favorites jsou ploché, picker není ACL |

Dále byla čtena [oficiální deprecations](https://docs.nextcloud.com/server/stable/developer_manual/release_notes/deprecations.html): nenalezeno používání IFunctionBuilder::md5, IBroadcastEvent ani ISynchronousWatermarkingProvider. Závislosti a testovací doubles nenahrazují běh proti skutečným OCP rozhraním.

## Známé otevřené závislosti

- `build/frontend/maps.ts`, `map-favorites.ts`, `settings.ts`, `about.ts` stále používají OC.generateUrl / OC.requestToken. OC namespace není garantované veřejné API. Nejde o odstraněné aliasy, ale zbývá ověřit reálné NC35 URL v podadresáři a autorizované zápisy. Kandidát tyto adaptéry neprohlašuje za bezrizikové. Statická kontrola zakazuje známé odstraněné položky, není to důkaz absence všech private API.
- `MapService::runtimeStatus` rozpoznává Redis podle názvu implementační třídy a zkouší add/inc/remove. Tato vazba se změnou NC může selhat; skutečný Redis musí projít kvalifikací. Health probe tvoří krátkodobý technický klíč, ne mapové dlaždice.
- Část native cache testů používá Reflection a doubles pro interní limiter. Jsou to interní unit testy, ne veřejný Playground test ani ověření autentizace/Redis.
- PHP8.5, NC34/35, MariaDB a provider účty nebyly v tomto prostředí dostupné. Není oprávněné z výsledku TypeScriptu vyvozovat funkčnost PHP či plnou kompatibilitu NC35.
- Podle [systémových požadavků](https://docs.nextcloud.com/server/stable/admin_manual/installation/system_requirements.html) je PHP8.5 podporovaná řada NC35 a MariaDB10.11 vyhovuje. To není test tohoto Core na konkrétním PHP8.5.10. Ověřit i hostitelský OS podle [upgrade poznámek](https://docs.nextcloud.com/server/stable/admin_manual/release_notes/upgrade_to_35.html).

## Provedené testy

- TypeScript Core + empty-app; Vue TypeScript Playground: PASS.
- Core: 38 testů v 15 souborech (layout, maps, bounded tile retry, GPS/follow, favorites, UI, settings, version a další): PASS.
- Playground unit test: 1 PASS; jeho HTTP/Core doubles samy nestačí.
- Sestavení obou runtime bundle a prázdné aplikace: PASS.
- Skutečné sestavené Core + empty-app: 8 simulovaných kombinací NC34/35 × funkční/chybějící/starý/API-major mismatch: PASS. Simulovaná NC verze není skutečný server a bootstrap ji sám nepoužívá.
- Skutečné sestavené Core + Playground: 16 veřejných kontrol a BFCache/unmount: PASS, HTTP odpovědi nahrazené fixtures. Ani tato kontrola nestahuje reálné mapové dlaždice.
- Rozsah metadat, status konstanta/kontrakt, dokumentace vs reference a seznam veřejných metod: automatické statické/bundle kontroly. Známá odstraněná API zakázána skenem.
- Shell syntax, konečné archivy a shoda kandidáta s manifesty se kontrolují při předání. PHP syntax/native cache testy zde NEPROVEDENY; připravené spouštění viz kvalifikace.

## Rozhodnutí o vydání

0.18.0-dev.1 je přípravný full-source kandidát k testování na oddělené kopii. Cílová deklarace 34–35 slouží umožnění kvalifikace; status výslovně přiznává pending stav. Stabilní 0.18.0 může vzniknout teprve po vyplnění obou sloupců kvalifikace, vyřešení případných chyb, aktualizaci všech verzí a odstranění pending označení v rámci výslovné release revize. Žádné API major navýšení není zatím potřebné.
