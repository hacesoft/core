[🇨🇿 Česky](../../README_CZ.md) | [🇬🇧 English](../../README.md)

# ARCHIVNÍ DOKUMENT – PŮVODNÍ PŘECHODOVÝ PLÁN

Zachováno beze ztráty historie. Tento původní text předpokládal kandidáta použitelný na NC34 i NC35 a není aktuálním support kontraktem Core 0.18.0-dev.13.

# Závazné pokyny pro aplikace: NC34 → NC35

**Stav: příprava pro kandidáta Core 0.18.0-dev.1. Stabilní Core 0.18.0 ještě není vydáno ani ověřeno na NC35. Tento dokument zatím není pokynem k produkční migraci.** Platí shodně pro Weather, Navigation, Sticky Notes, Home Wiki, Family Tree a LINEA Monitor. Core tyto aplikace v této změně neupravuje.

1. Aplikace, která sama úspěšně ověří obě verze Nextcloudu, deklaruje v `src/appinfo/info.xml`:
   ```xml
   <nextcloud min-version="34" max-version="35"/>
   ```
   Stejný rozsah musí respektovat její instalátor a případný runtime kontrakt. Neodstraňujte horní mez a nedeklarujte neotestované budoucí verze.
2. Pro testovací větev použijte v `appinfo/hc_shared_app_core.json` `requiredVersion: "0.18.0-dev.1"` a `requiredApiVersion: 1`. Po skutečném vydání stabilního Core nahraďte minimum hodnotou `0.18.0`. Čtěte minimum z manifestu i v šabloně a instalátoru; nevytvářejte další nezávislou konstantu. Žádná povinná pole manifestu se nepřejmenovávají. Prerelease není stabilní vydání.
3. Bootstrap se **nemění**: PHP načte Core CSS, CSS aplikace, Core JS, JS aplikace přes `OCP\Util`. Aplikace startuje při DOMContentLoaded nebo ihned, pokud DOM už existuje. Ověří existenci `window.HcSharedAppCore`, `apiVersion` proti manifestu a zavolá `assertCompatible(minimumString)`. Při chybě zobrazí vlastní jednoduchou chybu a nemountuje obsah. Převzít `build/examples/empty-app`; nevytvářet dynamický Guard, polling `/status`, časovač nahrazující load ani vlastní mini Core. Nativní kontrola rozsahu NC a instalátor nenahrazují kontrolu minima Core.
4. Identita zůstává: `hc_shared_app_core`, `OCA\HcSharedAppCore`, `window.HcSharedAppCore`, `hc-shared-app-core-v1`, API 1. `/status` má `installedVersion` (camelCase); není startovací synchronizační mechanismus. Cílový rozsah je 34–35; pole `qualification` kandidáta přiznává neprovedené provozní ověření.
5. **Layout API se nemění.** Použijte createAppLayout nebo observe, jediného vlastníka výšky/scrollu a vlastní root třídu při mountu. Neexistuje layout.create(). Zachovejte pinch zoom a oba směry posunu. Při pagehide s persisted=true neničte DOM/layout; skutečné opuštění uklidí resources.
6. **Maps API a cache se nemění.** Podklady jdou přes Core; klíče zůstávají serverově. Jedna mapa a doménové vrstvy; neobnovovat instanci při přepnutí vrstvy. Existující bounded retry respektuje Retry-After pro 429/503, ruší zastaralé požadavky a nesmí vytvářet nekonečnou smyčku. Migrace NC není důvod k vymazání cache ani klíčů.
7. **location/watchLocation/followLocation se nemění.** Sledujte smlouvu MAPS_LOCATION_CZ.md, clearWatch/stop/destroy, AbortSignal a ruční pan. GPS vyžaduje HTTPS, souhlas a test na skutečném zařízení.
8. **Favorites se nemění:** ploché list/add/update/remove. Core nemá obecnou službu sdílených seznamů a dědičných read/edit práv. Picker uživatelů/skupin není autorizační mechanismus. Doménové sharing/ACL, databázové migrace a NC35 změny sdílení musí ověřit každá aplikace sama.
9. **About/Updates a ostatní UI služby se nemění.** Načtěte Core CSS; připojené controllery při skutečném unmountu zničte. Nedostupný GitHub není chyba startu aplikace.
10. Každá aplikace projde celý oficiální seznam NC35 Critical Changes: Console7 execute():int, phpseclib3, OCP DB schema wrappers/odstraněné Column metody, odstraněná Remote/Preview/Calendar/AutoComplete/node-event API, podepsaná federace a odstraněné JS globály/knihovny. Ověří PHP8.5, své Composer dependencies a migrace na kopii dat. Core audit automaticky nekvalifikuje aplikaci. Zachovejte PHP minimum potřebné pro NC34; NC35 vyžaduje alespoň8.3.
11. Před vydáním aplikace doložte NC34 + nový Core a NC35 + nový Core: start, hlavní layout, používané služby, BFCache, chybu chybějícího/starého Core, upgrade a data. Při selhání souborů/CSS opravte skutečnou příčinu; nezvyšujte startup timeout.

Oficiální podklad: [NC35 Critical Changes](https://docs.nextcloud.com/server/stable/developer_manual/release_notes/critical_changes.html). Konkrétní provedené a neprovedené kontroly Core jsou v AUDIT_NC35_CZ.md a QUALIFICATION_NC34_NC35_CZ.md.
