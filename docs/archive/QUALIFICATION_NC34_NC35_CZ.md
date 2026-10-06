[🇨🇿 Česky](../../README_CZ.md) | [🇬🇧 English](../../README.md)

# ARCHIVNÍ DOKUMENT – NEPOUŽÍVAT PRO AKTUÁLNÍ CORE

Tento text zachovává historický kvalifikační plán z období, kdy se kandidát připravoval pro rozsah NC34–NC35. Aktuální řada Core 0.18.0-dev.13 deklaruje pouze NC35. Pro aktuální testy použijte `../QUALIFICATION_NC35_CZ.md`.

# Provozní kvalifikace NC34 a NC35

**Nevyplněné položky nejsou PASS.** Stav při předání: všechny níže uvedené runtime položky čekají. Místní JS výsledky jsou v AUDIT_NC35_CZ.md. Není dostupný PHP ani Docker běh; nebyla provedena instalace do uživatelova NASu. Neexistuje původní CI matrix, proto se nepředstírá její rozšíření; tato explicitní matice je release brána.

## Prostředí

1. Oddělená kopie funkčního NC34.0.4 + MariaDB10.11.19 + PHP8.5.10, stejný Redis a reverzní proxy. Uchovat zálohu kódu, DB, config a dat. Kandidáta nejprve ověřit na této kopii.
2. Z její obnovitelné kopie provést podporovaný upgrade na konkrétní NC35 build; zaznamenat přesnou verzi a digest/image. Produkci zatím nemigrovat. Zkontrolovat systémové požadavky NC35 včetně OS.
3. Na obou nainstalovat samostatně Core kandidát a Playground, případně empty-app; neupravovat spotřebitelské aplikace v tomto úkolu. Neobcházet kompatibilitu pomocí force-enable. Instalátor ověřuje soubory, nikoli kompletní HTTP běh.
4. Doplňující minimum: NC34/PHP8.2 a NC35/PHP8.3 nebo8.4. PHP8.2 nepoužívat s NC35. Zda je doplňující prostředí dostupné zaznamenat, nevyplňovat PASS za neprovedený test.

## PHP a backend před kontrolou prohlížeče

Z kořene rozbaleného Core spusťte pro konkrétní TESTOVACÍ kontejner (názvy nahraďte skutečnými):

```sh
sh build/scripts/qualify-container.sh nextcloud-test34 34 8.5
sh build/scripts/qualify-container.sh nextcloud-test35 35 8.5
```

Skript nic neinstaluje. Čte verze, kontroluje stav OCC, zkopíruje kandidátní PHP do izolovaného /tmp, spustí lint a native policy/storage/concurrency testy, uklidí /tmp. Nepoužívá produkční dlaždicovou cache. PASS skriptu není ověření reálného Redis ani webového PHP/OPcache. Pro lokální PHP lze spustit `sh build/scripts/lint-php.sh` a `cd build` → `php tests/php/cache.php`.

## Matice skutečných služeb

| Scénář a očekávaný výsledek | NC34/PHP8.5 | NC35/PHP8.5 |
|---|---|---|
| Instalace/upgrade bez ztráty nastavení, klíčů, favorites a cache | NEPROVEDENO | NEPROVEDENO |
| /status HTTP200, no-store, app/contract/API1, version=installedVersion=frontend, rozsah34–35 | NEPROVEDENO | NEPROVEDENO |
| Playground start a16 kontrol; skutečné Core CSS; reload, BFCache, žádný dvojí mount | NEPROVEDENO | NEPROVEDENO |
| Reference: kompatibilní Core; chybějící a starší Core bezpečně zastaví mount s chybou | NEPROVEDENO | NEPROVEDENO |
| Layout: mobil, desktop, pinch zoom, oba směry scrollu, orientace, split-screen | NEPROVEDENO | NEPROVEDENO |
| UI: dialog, toolbar, forms, picker, notifications, settings read/write | NEPROVEDENO | NEPROVEDENO |
| About/Updates: metadata, dostupný/nedostupný upstream bez blokování startu | NEPROVEDENO | NEPROVEDENO |
| GPS watch/follow: souhlas/odmítnutí/timeout, pan off, zoom zachován, AbortSignal, stop/destroy | NEPROVEDENO | NEPROVEDENO |
| Maps provider list, aktivní klíč maskován; neplatný nový klíč nezruší starý | NEPROVEDENO | NEPROVEDENO |
| Redis runtime available=true, žádné deadlocky ani opakované provider chyby | NEPROVEDENO | NEPROVEDENO |
| Jedna dlaždice dvakrát: první miss/hit, druhá hit; správný image MIME a cache hlavičky | NEPROVEDENO | NEPROVEDENO |
| Paralelní stejná dlaždice: jeden externí fetch; různé dlaždice nejsou globálně serializované | NEPROVEDENO | NEPROVEDENO |
| Pan/zoom/vrstvy/rotace: zrušení neaktuálních požadavků, 429 Retry-After, bounded retry, následné dokončení | NEPROVEDENO | NEPROVEDENO |
| Cache TTL/provider headers, kapacita, diagnostika, upgrade bez clear | NEPROVEDENO | NEPROVEDENO |
| Favorites CRUD vlastního testovacího účtu; druhý účet nečte cizí data | NEPROVEDENO | NEPROVEDENO |
| Sharees picker neobchází oprávnění; non-admin nemění provider/config/cache | NEPROVEDENO | NEPROVEDENO |
| URL v podadresáři, CSRF tokeny, web/cron sdílený strom, log bez nových chyb | NEPROVEDENO | NEPROVEDENO |

V NC35 je starý Core0.17.0 mimo deklarovaný rozsah. Očekávané bezpečné chování může být jeho deaktivace Nextcloudem; nový spotřebitel se správným minimem ukáže chybějící/starý Core. Netestovat force-enable starého balíku v produkci.

Na otevřeném kandidátním Playgroundu lze do konzole vložit obsah `build/tests/browser/nc35-qualification.js`. Ten čte HTTP endpointy a tiskne pouze výsledky, nikoli klíče či obsah uživatelských nastavení. Maps runtime health může vytvořit krátký technický Redis klíč. Další řádky matice vyžadují skutečné interakce. Mapové požadavky mohou spotřebovat kredity: používejte několik vybraných dlaždic a testovací nastavení. Mazání cache a neplatné klíče zkoušet jen v izolovaném prostředí. Nezvyšovat limity naslepo a neprohlašovat prázdnou mřížku Playgroundu za render test podkladů.

U každé položky zapsat datum, přesný build NC/PHP/Core, výsledek a log/screenshot. Selhání musí mít opravu a opakovaný relevantní test. Poté teprve připravit stabilní0.18.0, Playground a krátké pokyny pro aplikace.

## Reprodukce místních JS kontrol

```sh
cd build
npm ci
npm run check
npm run build
```

Totéž pro samostatný Playground. Navíc z jeho build adresáře:

```sh
node scripts/test-real-core.mjs /absolutni/cesta/core/src/js/hc_shared_app_core.js
```

Používá skutečné veřejné bundle obou balíků; HTTP je testovací fixture. Výstup nelze vydávat za NC runtime kvalifikaci.
