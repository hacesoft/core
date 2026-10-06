[🇨🇿 Česky](../README_CZ.md) | [🇬🇧 English](../README.md)

# Výstup instalátorů NC35 / NC35 installer output

## Česky

Instalátory Core, Playgroundu, referenční kostry, LINEA Monitoru, Počasí a Lístečků po úspěšném nasazení zobrazují jednotný stručný souhrn:

```text
Aplikace: Název aplikace
Verze: 0.17.7 -> 0.17.8
Velikost instalace: 480 KiB
Hotovo.
```

Při první instalaci je místo původní verze uvedeno `nová instalace`. Velikost je prostor obsazený nasazeným adresářem aplikace v `custom_apps`, nikoli velikost databáze, zálohy nebo staženého archivu. Instalační chyby vypisují celý provozní záznam a vracejí nenulový návratový kód; řádky `WARNING:` se ukazují i při dokončení instalace. Diagnostický režim `sudo env HC_INSTALL_VERBOSE_INTERNAL=1 sh install.sh` zobrazí všechny kroky přímo. Tento režim nepřeskakuje žádnou kontrolu.

Instalace nesmí zastavovat ani restartovat Docker kontejner Nextcloudu kvůli obnově PHP cache. Podle běžícího webového procesu použije šetrné opětovné načtení Apache nebo PHP-FPM. Pokud tuto operaci nelze provést, musí zobrazit upozornění nebo skutečnou chybu, nesmí mlčky tvrdit, že cache byla obnovena.

## English

The Core, Playground, reference skeleton, LINEA Monitor, Weather, and Sticky Notes installers print the same short success summary: application name, installed version before and after deployment, and disk space used by the installed `custom_apps` directory in KiB. The first installation reports `nová instalace` for the previous version. The size excludes the database, backups, and downloaded archives.

Installation failures print the complete diagnostic log and return a nonzero status; `WARNING:` lines remain visible on success. `sudo env HC_INSTALL_VERBOSE_INTERNAL=1 sh install.sh` displays all steps without bypassing checks. Deployments refresh Apache/PHP-FPM workers gracefully; they must not stop or restart the Nextcloud Docker container just to clear PHP cache.
