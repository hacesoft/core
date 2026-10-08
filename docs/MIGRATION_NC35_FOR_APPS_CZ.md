[🇨🇿 Česky](../README_CZ.md) | [🇬🇧 English](../README.md)

# Přechod aplikací z NC34 na NC35 – aktuální pravidla

**Aktuální Shared App Core 0.18.2 je pouze pro Nextcloud 35.** Jeho `info.xml`, runtime `/status`, referenční empty-app, testy i kvalifikační postup musí uvádět rozsah `35–35`. Aktuální Core se na NC34 neinstaluje ani neforce-enable.

## Závazný postup

1. Zdrojové prostředí NC34 ponechte na verzi Core, která je v jeho vlastním `info.xml` deklarovaná jako kompatibilní s NC34. Aktuální Core 0.18.x se na NC34 nepoužívá.
2. Nejprve proveďte podporovaný upgrade samotného Nextcloudu na NC35 a ověřte jeho stav. Až na NC35 instalujte aktuální Core.
3. Spotřebitelská aplikace určená pro současnou větev má deklarovat jen verze Nextcloudu, které skutečně podporuje a testuje. Aktuální referenční empty-app Core je NC35-only.
4. Bootstrap aplikace zůstává: Core CSS → CSS aplikace → Core JS → JS aplikace přes `OCP\Util`, následně `apiVersion` a `assertCompatible(requiredVersion)`. Nepoužívat starý dynamický Guard ani polling `/status`.
5. `hc_shared_app_core`, `OCA\HcSharedAppCore`, `window.HcSharedAppCore`, kontrakt `hc-shared-app-core-v1` a API major 1 zůstávají beze změny. `/status` pouze popisuje nainstalovaný Core; není startovací synchronizační mechanismus.
6. Layout, Maps, Location, Favorites, About/Updates a další používané služby se při migraci testují na NC35. Doménová data, ACL a DB migrace zůstávají odpovědností spotřebitelské aplikace.
7. Každá aplikace musí projít relevantní NC35 API změny a vlastní runtime test na kopii dat. Úspěch Core automaticky nekvalifikuje spotřebitelskou aplikaci.

## Co se nesmí dělat

- neinstalovat Core 0.18.x na NC34;
- neobcházet omezení `info.xml` pomocí force-enable;
- nedeklarovat `34–35` jen proto, že starší dokument takový rozsah kdysi uváděl;
- nevydávat simulovaný browser test za skutečnou provozní kvalifikaci.

