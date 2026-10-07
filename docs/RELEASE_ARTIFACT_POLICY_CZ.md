[🇨🇿 Česky](../README_CZ.md) | [🇬🇧 English](../README.md)

# Shared App Core — pravidla release artefaktů

Tento dokument je závazný pro `hc_shared_app_core` . Cílem je, aby instalační balík obsahoval pouze runtime soubory a aby velikost balíků nebyla závislá na náhodně ponechaných vývojových artefaktech.

## 1. Source mapy

- Canonický Core build má `sourcemap: false`.
- Soubory `*.map` **nesmí být** v `src/js/`, runtime ZIP/TAR ani ve full-source ZIPu.
- Runtime JavaScript **nesmí** obsahovat `//# sourceMappingURL=...` ani ekvivalentní odkaz.
- Source map není podmínkou běhu Core a nepoužívá se jako release artefakt.
- Pokud vývojář potřebuje source map pouze pro lokální ladění, musí použít lokální dočasnou konfiguraci mimo release proces; takový výstup se nesmí commitnout ani zabalit.

## 2. Runtime balík

Runtime balík smí obsahovat pouze soubory nutné pro běh aplikace:

```text
hc_shared_app_core/
├── appinfo/
├── css/
├── js/
├── lib/
└── LICENSE
```

Neobsahuje `build/`, `docs/`, testy, `node_modules`, TypeScript zdroje, reporty ani source mapy.

## 3. Full-source balík

Full-source ZIP obsahuje zdroje, dokumentaci, build/test skripty a současně sestavené runtime soubory, aby šel použít pro audit i instalaci. Neobsahuje:

- `node_modules/`,
- source mapy `*.map`,
- dočasné build adresáře,
- testovací reporty nebo cache,
- staré release artefakty vložené do sebe.

## 4. Povinné build kontroly

`build-release.sh` musí release zastavit, pokud:

- se po buildu objeví `src/js/*.map`,
- runtime JS obsahuje `sourceMappingURL`,
- runtime ZIP/TAR obsahuje `*.map`,
- full-source ZIP obsahuje `*.map`.

Kontrola není doporučení; je to release gate.

## 5. Verze a neměnnost vydaných balíků


