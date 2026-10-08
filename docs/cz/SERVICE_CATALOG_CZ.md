[🇨🇿 Česky](../../README_CZ.md) | [🇬🇧 English](../../README.md)

# Katalog veřejných služeb

Autoritativní přehled včetně stupně ověření je v [CORE_NC35_CZ.md](CORE_NC35_CZ.md), anglicky v [CORE_NC35_EN.md](../CORE_NC35_EN.md).

Veřejným vstupem je `window.HcSharedAppCore` (API 1). Obsahuje `version`, `apiVersion`, `assertCompatible`, `events`, `config`, `logger`, `workspace`, `layout`, `dialogs`, `notifications`, `toolbar`, `forms`, `settings`, `picker`, `about`, `updates`, `maps`, `lists`, `editor`, `background` a `concurrency`. Pokud aplikace obecnou službu Core potřebuje, používá toto veřejné API.

Typy jsou v `build/frontend/index.ts`, `lists.ts`, `editor.ts`, `background.ts` a dalších modulech. Úplný startovací příklad: `build/examples/empty-app/`. Editor ukládání neprovádí; seznamy mají vlastní databázovou migraci. Seznamy ani editor nejsou kvalifikovány na NASu. Dřívější dokumenty o NC34 jsou archivní.


## Editor – rendering contract 0.18.2
`editor.create()` a `editor.render()` používají stejný bezpečný Markdown renderer. Renderované plochy používají třídu `hc-core-markdown`. `editor.create()` přijímá `decoratePreview(fragment, markdown)`; při samostatném `editor.render()` spotřebitel stejný dekorátor zavolá nad vráceným bezpečným fragmentem. Viz `EDITOR_RENDERING_CZ.md`.


## Concurrency – společný klientský kontrakt 0.18.2

`core.concurrency` sjednocuje klientskou část optimistic concurrency. `withExpectedRevision(payload, revision)` přidá `expectedRevision`, `isConflict(...)` rozpozná HTTP 409, `mergeText(base, local, remote)` konzervativně sloučí nekolizní textové změny a `resolveConflict(...)` otevře standardní konflikt dialog.

Core tím **nenahrazuje atomickou kontrolu na serveru aplikace**. Spotřebitel musí provést compare-and-swap / podmíněný UPDATE nad vlastní revizí ve stejné transakci, ve které potvrzuje změnu. Samotné porovnání dříve načtené hodnoty bez atomického UPDATE není dostatečné. Podrobný kontrakt a povinné testy jsou v `MULTI_USER_CONCURRENCY_STANDARD_CZ.md`.
