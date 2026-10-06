# Prázdná referenční aplikace

Funkční vzor jednoduchého startu pro Core na NC35. PHP šablona načte Core CSS, CSS aplikace, Core JS a JS aplikace. `frontend/main.ts` ověří globální Core, kompatibilitu a provede mount.

`install.sh` musí používat `scripts/custom-apps-safety.sh`. `custom_apps` obsahuje jen živý adresář aplikace; staging vzniká v `/tmp` a zálohy zůstávají v datovém adresáři Nextcloudu. Tento soubor musí zůstat součástí zdrojového balíčku aplikace. [Instalace česky](docs/cz/INSTALACE.md) · [Installation in English](docs/en/INSTALLATION.md).

Neobsahuje Guard, status polling, retry smyčku ani dynamický loader assetů.
