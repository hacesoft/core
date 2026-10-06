[🇨🇿 **Česky**](INSTALACE.md) | [🇬🇧 English](../en/INSTALLATION.md)

# Instalace vzorové aplikace

`sudo sh install.sh` nejprve opraví staré duplicitní kopie našich aplikací pomocí `scripts/custom-apps-safety.sh`, potom ověří nový kód v `/tmp` a nasadí jej pouze pod kanonickým App ID. V `custom_apps` nikdy nevytvářejte `*.new`, `*.old`, `*.backup` ani jiné pracovní adresáře obsahující `appinfo/info.xml`. Zálohy uchovávejte mimo `custom_apps`, ideálně v datovém adresáři Nextcloudu. Do budoucích aplikací kopírujte celý vzorový instalátor i jeho pomocný skript.
