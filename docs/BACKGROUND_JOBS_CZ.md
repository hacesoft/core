[🇨🇿 Česky](../README_CZ.md) | [🇬🇧 English](../README.md)

# Úlohy na pozadí po migraci NC35

Core sám nyní žádnou úlohu na pozadí neregistruje. Každá aplikace musí spravovat vlastní registrace při instalaci, aktualizaci, deaktivaci a odinstalaci. Registrace přes `<background-jobs>` v `info.xml` proběhne při instalaci/aktualizaci; pro úlohy s argumenty slouží `IJobList::add`/`remove` ([dokumentace NC35](https://docs.nextcloud.com/server/stable/developer_manual/basics/backgroundjobs.html)).

1. Před zásahem zálohujte databázi a opište `class`, `id`, `argument` z `sudo docker exec -u www-data nextcloud-app php occ background-job:list`.
2. Vyhledejte přesné staré názvy tříd Lístečků a GridSightu v seznamu a v logu. Samotná shoda části názvu nestačí pro mazání; porovnejte třídu, ID aplikace, argumenty a zdrojový kód. Bez těchto údajů příčinu nelze určit.
3. Při přejmenování aplikace nebo třídy udržujte starou třídu dostupnou do cílené migrace registrací; odstraňte přes `IJobList::remove(OldClass::class, $arguments)`, je-li kód stále dostupný. Novou úlohu zaregistrujte jednou a otestujte opakovaný upgrade.
4. Pokud třída již neexistuje, ověřte jednotlivý nalezený záznam a spusťte `sudo docker exec -u www-data nextcloud-app php occ background-job:delete ID`. Příkaz zobrazí podrobnosti a požádá o potvrzení. Nikdy nemažte celou tabulku background jobs ([dokumentace příkazu](https://docs.nextcloud.com/server/stable/admin_manual/occ_system.html#background-job-delete)).
5. Po deaktivaci zkontrolujte opět `background-job:list`, sledujte log v dalším cyklu cronu, pak otestujte novou aktivaci. Před smazáním souborů aplikace zaručte, že nezůstanou odkazy na neexistující třídy. Při odinstalaci odstraňujte registrace úloh, nikoli uživatelské dokumenty.

Samotná podmínka uvnitř `run()` neopraví chybějící PHP třídu. Testovací matice pro každou ze šesti aplikací: čistá instalace, druhá instalace/upgrade, deaktivace, nový cron cyklus, aktivace, odinstalace a migrace starého názvu třídy. Dodání konkrétní opravy Lístečků a GridSightu vyžaduje jejich zdroje a výpis úloh/logů.
