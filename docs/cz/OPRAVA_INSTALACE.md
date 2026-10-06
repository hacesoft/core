[🇨🇿 **Česky**](OPRAVA_INSTALACE.md) | [🇬🇧 English](../en/INSTALLER_RECOVERY.md)

# Core: opakovatelná instalace na NC35

Po rozbalení úplného zdrojového balíčku do příslušného adresáře NAS spusťte pouze:

```sh
sudo sh install.sh
```

Instalátor při každém spuštění ověří potřebnou strukturu databáze. Používá pouze vytvoření chybějících tabulek, sloupců nebo indexů; nepřevádí řádky mezi tabulkami, nevolá `migrations:migrate` ani globální `occ upgrade` a nemaže uživatelské záznamy. Core doplní pouze chybějící tabulky, sloupce a indexy pro seznamy, místa a práva. Názvy vlastních tabulek začínají aplikačním `hc_` a Nextcloud připojí svůj systémový prefix (na tomto NASu `oc_`).

**Přerušená instalace:** Skript při chybě obnoví předchozí běhový kód, stav zapnutí a uložené číslo verze. Pokud má cron vlastní svazek, obnoví také jeho kód. Záloha kódu zůstane v `<datadirectory>/hc-core-deployment-backups/`; doplněné schéma databáze se nevrací zpět a uložené řádky zůstávají zachované. Při chybě se vypíše celý protokol a běh skončí neúspěchem. Po nápravě příčiny spusťte `sudo sh install.sh` znovu.

Pokud protokol obsahuje `Database schema: OK (4 tables)` a následně hlásí chybějící `Core info.xml`, databáze prošla kontrolou. Starší kontrolní skript chybně spojoval ověření souboru s ověřením schématu a popsal výsledek jako chybu databáze. Aktualizovaný instalátor ověřuje čitelnost a verzi skutečně nasazeného `info.xml` zvlášť před kontrolou DB. Pokud nyní soubor chybí, zobrazí přesnou cestu a obnoví předchozí kód. Úspěšnou instalaci potvrzují čtyři řádky končící `Hotovo.`

Před nasazením nad živá data ponechte existující zálohu databáze. Výsledek chování v prohlížeči, přístupová práva a funkčnost úloh ověřte na NASu; místní testy nenahrazují provozní ověření.

## Závazné umístění pracovních souborů

`custom_apps` je výhradně produkční adresář: obsahuje pouze živou složku přesně pojmenovanou podle App ID. Instalátor před prvním `occ` pomocí `scripts/custom-apps-safety.sh` přesune dřívější chybné kopie našich aplikací s duplicitním `appinfo/info.xml` do `<datadirectory>/hc-core-deployment-backups/custom-apps-quarantine/`; nemaže je. Nový kód kontroluje v `/tmp` a při chybě uklidí své pracovní adresáře. Zálohy zůstávají mimo `custom_apps`. Stejné pravidlo platí i pro samostatný cron svazek.
