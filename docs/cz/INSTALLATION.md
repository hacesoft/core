[🇨🇿 **Česky**](../cz/INSTALLATION.md) | [🇬🇧 English](../en/INSTALLATION.md)

# Instalace a aktualizace

Shared App Core (`hc_shared_app_core`) poskytuje společné služby pro aplikace Nextcloud 35. Konkrétní kompatibilitu s dalšími verzemi je nutné ověřit před instalací.

## Instalace z App Store

V administraci Nextcloudu otevřete **Aplikace**, vyhledejte **Shared App Core** a zvolte instalaci. Tato možnost je dostupná až po veřejném vydání aplikace v katalogu. Instalátor nemusí spouštět vlastní shell skripty.

## Ruční instalace

Stáhněte podepsaný runtime archiv odpovídající požadované verzi, ověřte jeho původ a rozbalte ho do povoleného adresáře `custom_apps/hc_shared_app_core`. Aktivujte aplikaci standardním správcem aplikací Nextcloudu nebo příkazem `php occ app:enable hc_shared_app_core` pod účtem webového serveru. Neinstalujte zdrojový archiv místo runtime archivu.

## Aktualizace a deaktivace

Před aktualizací zálohujte databázi a konfiguraci podle pravidel správce Nextcloudu. Upřednostněte běžný mechanismus aktualizace Nextcloudu. Deaktivace je odlišná od úplné odinstalace; před odstraněním aplikace ověřte práci se závislými aplikacemi a zásady uchování dat příslušné verze.
