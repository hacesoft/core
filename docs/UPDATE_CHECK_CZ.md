[🇨🇿 **Česky**](UPDATE_CHECK_CZ.md) | [🇬🇧 English](UPDATE_CHECK_EN.md)

# Kontrola verzí aplikace a Core

Každá aplikace kontroluje svůj vlastní GitHub repozitář a samostatně společné Core. Ve výchozí větvi repozitáře je zveřejněná verze v `src/appinfo/info.xml`. Nečte se README ani obsah instalačního ZIPu. Na NASu může být vyšší verze než na GitHubu; to je při vývoji očekávané.

| Součást | Repozitář | Očekávané `<id>` |
| --- | --- | --- |
| Core | `hacesoft/core` | `hc_shared_app_core` |
| Playground | `hacesoft/Playground` | `hc_shared_app_core_playground` |
| GridSight | `hacesoft/GridSight` | `hc_gridsight` |
| Žluté lístečky | `hacesoft/nextcloud-stickynotes` | `hc_stickynotes` |

Další aplikace registrují svou skutečnou adresu a technické ID pomocí `CORE.about.register({id, name, version, repository})`. Stejný mechanismus pak kontroluje jejich vlastní soubor XML. Core si vždy kontroluje `hacesoft/core`.

## Přesný postup

1. Pro GridSight Nextcloud požádá `https://api.github.com/repos/hacesoft/GridSight/contents/src/appinfo/info.xml`. Bez parametru `ref` jde o výchozí větev; nemusí se jmenovat `main`.
2. Z JSON odpovědi ověří `type: file` a `encoding: base64`, dekóduje `content` a bezpečně načte XML bez externích entit. Čte `<info><version>` a `<info><id>`; musí být právě jedna hodnota každého pole. Verze musí být platný SemVer. Chybné ID odmítne kontrolu i záložní zdroj, aby nezobrazovala jiný produkt.
3. Pokud XML nelze získat nebo neobsahuje použitelnou verzi, požádá `https://api.github.com/repos/hacesoft/GridSight/contents/release`. Čte jen objekty `type: file` a z `name` zjistí verze archivů. Vybere nejvyšší verzi, nikoliv nejstarší soubor. Pro záložní archivy se ID z jejich obsahu nekontroluje, proto v adresáři musí být pouze balíčky dané aplikace.
4. Odkaz pro uživatele bere z `html_url`. Pro Core používá stejné relativní cesty v repozitáři `hacesoft/core`; ostatní aplikace svůj registrovaný repozitář.

Tagy ani API `/releases/latest` se již nevolají. Úspěšné XML má přednost před adresářem `release/`, i kdyby v něm byl archiv s vyšší verzí. Hodnota `<version>` ve výchozí větvi tedy označuje aktuální veřejnou verzi.

| Přímý zdroj XML | Záložní adresář |
| --- | --- |
| `https://api.github.com/repos/hacesoft/core/contents/src/appinfo/info.xml` | `https://api.github.com/repos/hacesoft/core/contents/release` |
| `https://api.github.com/repos/hacesoft/GridSight/contents/src/appinfo/info.xml` | `https://api.github.com/repos/hacesoft/GridSight/contents/release` |
| `https://api.github.com/repos/hacesoft/nextcloud-stickynotes/contents/src/appinfo/info.xml` | `https://api.github.com/repos/hacesoft/nextcloud-stickynotes/contents/release` |
| `https://api.github.com/repos/hacesoft/Playground/contents/src/appinfo/info.xml` | `https://api.github.com/repos/hacesoft/Playground/contents/release` |

## Porovnání a názvy archivů

| Nainstalovaná verze proti GitHubu | Zobrazený stav |
| --- | --- |
| Stejná | Aktuální |
| Nižší | Dostupná aktualizace |
| Vyšší | Novější než zveřejněná |
| Vzdálenou verzi nelze zjistit | Kontrola není dostupná |

Používá se SemVer: `1.10.0 > 1.9.0`, `dev.16 > dev.9`, finální `1.0.0 > 1.0.0-rc.1`. Build metadata `+build.2` pořadí nemění. XML obsahuje čistou verzi, například `<version>2.0.11</version>`.

Záložní archivy končí `.zip`, `.tar.gz` nebo `.tgz`. Před příponou lze použít `-source`, `-full-source`, `-runtime`, `-install` nebo `-bundle`, také s podtržítky. `hc_stickynotes-2.0.11-source.zip` znamená `2.0.11`; `hc-shared-app-core-0.18.1-full-source.zip` znamená `0.18.1`. Čas nahrání ani velikost souboru nerozhodují. Při stejné verzi se výběr pro opakovatelný výsledek řídí adresou odkazu.

## Cache a diagnostika

Prohlížeč volá přes Nextcloud `OC.generateUrl()` serverovou cestu:

```text
/apps/hc_shared_app_core/api/v1/release?repository=hacesoft%2FGridSight&appId=hc_gridsight
```

Server komunikuje s veřejným GitHub API bez přihlašovacího tokenu a bez uživatelských dat. Posílá `Accept: application/vnd.github+json`, `User-Agent: HC-Shared-App-Core/0.18.1` a `X-GitHub-Api-Version: 2022-11-28`. Timeout požadavku je 8 sekund, spojení 4 sekundy.

Výsledek ukládá do Nextcloud app config Core pod `release-cache:v3:<repozitář malými písmeny>:<ID aplikace>`. Úspěšný výsledek platí 6 hodin a sdílí ho uživatelé instance. Neúspěch bez předchozího výsledku se ukládá na 5 minut. Při výpadku s dřívějším platným výsledkem se vrátí tento výsledek s `stale: true` a časem pokusu `attemptedAt`.

Kontrola běží při otevření O aplikaci nebo volání `CORE.updates.check()`, **nikoliv periodicky na pozadí**. Po vypršení cache další požadavek načte GitHub znovu. `aboutController.refresh()` nebo `CORE.updates.checkComponent({...registrace, refresh: true})` vynechají cache. Přihlášený uživatel může pro diagnostiku přidat `&refresh=1` k serverové cestě.

V nástrojích prohlížeče → Síť otevřete odpověď `api/v1/release`. Obsahuje například:

```json
{
  "available": true,
  "repository": "hacesoft/nextcloud-stickynotes",
  "appId": "hc_stickynotes",
  "version": "2.0.11",
  "tag": "2.0.11",
  "source": "appinfo-xml",
  "sourceUrl": "https://api.github.com/repos/hacesoft/nextcloud-stickynotes/contents/src/appinfo/info.xml",
  "fileName": "src/appinfo/info.xml",
  "url": "https://github.com/hacesoft/nextcloud-stickynotes/blob/main/src/appinfo/info.xml",
  "checkedAt": 1791352800,
  "cached": false
}
```

`source` je `appinfo-xml` nebo `release-directory`; `sourceUrl` označuje přesný použitý zdroj a `fileName` soubor. `checkedAt` je čas načtení v Unix sekundách. Stavový štítek O aplikaci ukazuje zdroj také v tooltipu. Neúspěšná kontrola neznamená, že je aplikace aktuální.

## Testy

Frontend: `cd build && npm run check && npm run build`. Samostatné PHP testy XML, ID, bezpečného načtení a záložních archivů: `cd build && npm run check:releases` (PHP s rozšířením SimpleXML). Testy nekontaktují GitHub ani Nextcloud.

Specifikace: [GitHub Contents API](https://docs.github.com/en/rest/repos/contents).
