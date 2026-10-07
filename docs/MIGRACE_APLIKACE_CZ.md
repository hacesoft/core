[🇨🇿 Česky](../README_CZ.md) | [🇬🇧 English](../README.md)

# Migrační playbook aplikace

1. Zálohujte zdroj a databázi; adresář `old/` je výhradně uživatelský a instalační ani build skript do něj nesmí zapisovat.
2. Deklarujte minimum Core v jediném kontraktním JSONu uvnitř `src/appinfo/` a stejnou hodnotu použijte v instalátoru a šabloně.
3. Odstraňte vlastní Core Guard, status polling, dynamické asset loadery a duplicitní načtení bundle.
4. Převzít přesně start ze `build/examples/empty-app` a změnit pouze ID, verze a funkci mountu.
5. Zapojte povinné Core CSS a JS v pořadí z `START_APLIKACE_CZ.md`.
6. Aktivujte vlastní root CSS třídu při mountu, pokud na ní aplikační selektory závisejí.
7. Nahraďte obecné lokální služby odpovídajícími službami Core. Doménové služby ponechte.
8. Layout otestujte na desktopu, tabletu, mobilu, landscape, split-screen a po pinch zoomu.
9. Mapy otestujte rychlým pan/zoomem, přepnutím provideru, cache hit/miss a reakcí na 429/503.
10. Databázovou migraci dělejte transakčně, idempotentně a po instalaci ověřte počty i vazby. Automaticky nemažte stará data.
11. Ověřte čistou instalaci, upgrade, downgrade pouze pokud je podporovaný, chybějící Core a starší Core.
12. Instalační staging nikdy nevytvářejte jako další viditelný adresář přímo v `custom_apps` (například `app_id.new.123`). Nextcloud každý takový adresář zkouší načíst jako aplikaci. Zdroj nejprve sestavte a validujte v `/tmp`; do `custom_apps/<app_id>` přesuňte až hotový strom. Existující pozůstatky `<app_id>.new.*` nejprve identifikujte a přesuňte mimo skenované adresáře; nemažte naslepo cizí či aktivní strom.

Výsledek migrace musí obsahovat seznam použitých služeb Core, zachovaných doménových částí, provedených testů a známých omezení.

Pro přechod instalace z NC34 na současnou NC35 větev použijte [MIGRATION_NC35_FOR_APPS_CZ.md](MIGRATION_NC35_FOR_APPS_CZ.md); aktuální Core se na NC34 neinstaluje.
