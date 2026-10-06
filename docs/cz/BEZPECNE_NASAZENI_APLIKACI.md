[🇨🇿 **Česky**](BEZPECNE_NASAZENI_APLIKACI.md) | [🇬🇧 English](../en/SAFE_APP_DEPLOYMENT.md)

# Závazné pravidlo: `custom_apps` je produkční prostor

V `/var/www/html/custom_apps` smí mít naše aplikace pouze svůj jediný živý adresář pojmenovaný přesně podle `<id>` v `appinfo/info.xml`. Pracovní stromy `app.new.*`, kopie `app.old`, zálohy `app.backup*` ani archiv `app.tmp*` sem nepatří. Nextcloud prochází i další adresáře v `custom_apps`; platné `appinfo/info.xml` s duplicitním App ID může zablokovat `occ upgrade`.

Instalátor proto ještě **před prvním voláním `occ`** načte `scripts/custom-apps-safety.sh`. Ten projde webový i cron kontejner, zkontroluje ID v manifestu a dřívější chybně uložené kopie našich aplikací přesune bez mazání do `<datadirectory>/hc-core-deployment-backups/custom-apps-quarantine/`. Pokud by jiná aplikace neměla živý adresář s kanonickým názvem, odmítne přesunout její jedinou kopii. Při úspěšném přesunu vypíše upozornění i umístění zachované zálohy. Ostatní, cizí aplikace nemění.

Nové soubory se kopírují a kontrolují v soukromém `/tmp/<app>.install.<pid>`; případný další `*.new.<pid>` zůstává také v `/tmp`. Dřívější kód patří do záloh v datovém adresáři Nextcloudu nebo mimo `custom_apps`. Až ověřený obsah se přesune pod jediný finální název. EXIT trap uklízí jen přesné dočasné adresáře, ne uložené zálohy ani data uživatelů. Pravidlo platí pro `install.sh`, budoucí `update.sh`, oddělený cron svazek a kostru v `build/examples/empty-app/`.

Po instalaci lze přečíst názvy a ID v kontejneru; tento příkaz nic nemění:

```sh
sudo docker exec nextcloud-app sh -c 'for d in /var/www/html/custom_apps/*; do [ -f "$d/appinfo/info.xml" ] || continue; printf "%s -> " "${d##*/}"; sed -n "s:.*<id>\\([^<]*\\)</id>.*:\\1:p" "$d/appinfo/info.xml" | head -n 1; done'
```

Původní problém s duplicitami našich aplikací nesouvisí s databázovým indexem `tta_throom_attendee` aplikace Nextcloud Talk. Instalátory našich aplikací tento index neupravují.
