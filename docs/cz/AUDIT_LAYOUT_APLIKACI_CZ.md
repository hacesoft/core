[🇨🇿 **Česky**](AUDIT_LAYOUT_APLIKACI_CZ.md) | [🇬🇧 English](../en/AUDIT_LAYOUT_APLIKACI_EN.md)

# Kontrola mobilního layoutu aplikací · 26. 9. 2026

Kontrola vychází ze zdrojových balíčků předaných do 26. 9. a z opravy GridSight 0.8.0-dev.6. Jde o kontrolu kódu a lokální testy Core, nikoli o potvrzení vzhledu na telefonu nebo běhu na NASu. Srovnání s aktuálně nasazenými soubory na NASu ještě neproběhlo.

## Společná příčina

Core 0.18.0-dev.3 používal `visualViewport.height` i jako výšku celého obalu. Při přiblížení prsty se viditelný výřez zmenšuje, a obal proto může ztratit výšku a odhalit pozadí dole. Současně `overscroll-behavior: contain` na společné posuvné oblasti zastavovalo předání vodorovného pohybu na hraně. Core 0.18.0-dev.5 používá při `visualViewport.scale > 1` pro **výšku obalu** `window.innerHeight` a u společné posuvné oblasti nechává vodorovný pohyb pokračovat. `metrics.viewportHeight` zůstává skutečnou výškou viditelného výřezu pro dialogy; při běžné velikosti zůstává reakce na softwarovou klávesnici.

| Aplikace a kontrolovaná verze | Zjištění ve zdrojovém kódu | Další krok na telefonu |
| --- | --- | --- |
| Playground 0.18.0-dev.5 | Používá veřejné Layout API. Uživatel už potvrdil přiblížení a posun v ukázkovém UI na PC; současná oprava Core nemění jeho aplikaci. | Potvrdit pinch a oba směry posunu na telefonu. |
| Počasí 0.17.7 → 0.17.8 | Poslední pravidlo `#wp-app.wp-app` přebírá výšku z Core a převážilo dřívější mobilní pravidlo se stabilní `svh`. Aplikační posuvná oblast znovu nastavovala `overscroll-behavior: contain`; dev.8 ponechává vodorovné předání. Mapa má vlastní gesta. | Přiblížit přehled mimo mapu, posunout jej v obou směrech; zvlášť vyzkoušet posun a zoom mapy. |
| Lístečky 2.0.7 | Jednosloupcová mobilní nástěnka, vlastní posuv hlavního obsahu a dialogy s velikostí podle viditelného výřezu. Obal měří Core; stejný široký grid jako v GridSightu nalezen nebyl. | Přiblížit nástěnku, otevřít dlouhý lísteček a ověřit posun stránky i dialogu. |
| Wiki 0.3.6-dev.1 | Mobilní panel se skládá do jednoho sloupce, dlouhý obsah se zalamuje. Výška kořene přímo používá `--hc-shared-app-core-available-height`; těží z opravy Core. | Přiblížit dlouhou stránku, otevřít postranní panel a vložit širokou tabulku. Vytváření stránky je samostatný funkční test. |
| Rodokmen 0.8.1-dev.2 → dev.3 | Mobilní panel se skládá do jednoho sloupce. Široký rodokmen se úmyslně posouvá uvnitř plátna; `overscroll-behavior: contain` blokovalo pokračování vodorovného pohybu na jeho hraně. Dev.3 mění jen osu X. | Přiblížit rozsáhlý strom, posunout se na okraj a zpět; vyzkoušet modální formulář. |
| Navigace 0.9.13-dev.1 | Kořen přímo používá výšku Core; mapa má vlastní dotyková gesta, boční seznam je na mobilu samostatný panel. Pětisloupcový přetlak GridSightu nenalezen. | Zkouška mapy, hledání a seznamu po pinch zoomu; mapa se posouvá samostatně. |
| GridSight 0.8.0-dev.6 | Pozdější pravidlo pěti sloupců klimatizace bylo opraveno přímo v aplikaci; obal už má stabilní výšku a vodorovné předání. | Potvrdit teploty, částku SPOT a oba směry posunu na skutečném telefonu. |

**Stav:** společná příčina je opravena a lokálně otestována v Core; Počasí a Rodokmen mají drobnou cílenou opravu svého CSS. Ostatní aplikace nejsou tímto auditem prohlášené za provozně ověřené. Při zkoušce na NASu je třeba zaznamenat přesné instalované verze a případné další prvky přetékající v reálných datech.
