[🇨🇿 Česky](../README_CZ.md) | [🇬🇧 English](../README.md)

# Provozní zkouška na NC35

Zálohujte databázi a adresáře aplikací. Vývojové sestavení nejprve instalujte na testovací instanci, ne místo živého Core. Po sestavení ZIPů zkontrolujte, že oba obsahují nové JS assety, správné `info.xml` a požadovanou verzi Core.

1. `sudo docker exec -u www-data nextcloud-app php occ status` — musí hlásit NC35 a `needsDbUpgrade: false` po dokončení upgradu aplikace.
2. `sudo docker exec -i -u www-data nextcloud-app php < build/tools/verify-core-install.php` spusťte v kořeni zdrojového balíku; skript jen čte verzi a schéma tabulek `hc_core_lists`, `hc_core_places`, `hc_core_list_acl`, `hc_core_place_acl` a sloupce `parent_id`, `icon`. NC35 na cílovém NASu nepodporuje příkaz `migrations:migrate`.
3. Zkontrolujte syntaxi PHP před instalací: `sudo docker exec nextcloud-app sh -c 'find /var/www/html/custom_apps/hc_shared_app_core/lib -name "*.php" -exec php -l {} \;'` a výsledek kontroly schématu. Přímé sdílení jediného místa nesmí odhalit ostatní místa v jeho seznamu. Ověřte také odmítnutí cyklu rodičů a zachování původních seznamů.
4. Přihlaste se do Playgroundu; vytvořte seznam a místo. Obnovte stránku a ověřte, že data zůstala.
5. Přihlaste se druhým uživatelem: bez sdílení data neuvidí; udělte `read` a ověřte zákaz zápisu; udělte `edit` a ověřte změnu místa. Totéž otestujte u členství ve skupině a po odebrání člena. Ověřte izolaci namespace jiné aplikace.
6. Ověřte kopii původních míst a ponechání původních dat. Zkuste opakované načtení a souběžné požadavky dvou relací; zaznamenejte počet záznamů a duplicity.
7. V editoru vložte `<script>alert(1)</script>`, odkaz `javascript:` a URL obrázku bez HTTPS; v náhledu se nesmí spustit skript ani načíst nepovolený obrázek.
8. Zkontrolujte skutečnou dlaždici mapy přes Core proxy, GPS povolení/odmítnutí, sledování po ručním posunu, mobilní resize a dotykový zoom.
9. Projděte log PHP/Nextcloud, chyby DB a `background-job:list`. Výsledek a přesné verze zapište před vydáním.

Zelené testy Playgroundu nepotvrzují tyto body automaticky. Pokud migrace, práva nebo import selžou, nepřecházejte s aplikacemi na novou službu.

## Přerušená instalace

Spusťte znovu `sudo sh install.sh`; postup je v [opravě instalace](cz/OPRAVA_INSTALACE.md).
