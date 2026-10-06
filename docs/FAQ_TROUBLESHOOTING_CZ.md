[🇨🇿 Česky](../README_CZ.md) | [🇬🇧 English](../README.md)

# Časté problémy

| Projev | Pravděpodobná příčina | Oprava |
|---|---|---|
| Prázdná stránka | bundle aplikace se nenačetl nebo JS spadl před mountem | Network/Console; ověřit čtyři `Util::add*` řádky a jediný bundle |
| Syrové HTML | chybí CSS nebo hlavní root třída | načíst oba styly; třídu přidat při mountu |
| Falešně „Core je staré“ | starý status polling nebo browser cache | odstranit Guard; používat načtený `window.HcSharedAppCore` |
| Aplikace visí na startu | retry smyčka/čekání na status | přejít na jednoduchý start 0.16.1 |
| Mapa má prázdné dlaždice | 429/503, chybná URL nebo zrušené požadavky | zkontrolovat Network status a `Retry-After`; nepovažovat JSON chybu za obrázek |
| Mobil nejde posouvat vodorovně | `touch-action`, `overflow-x` nebo `preventDefault()` | odstranit aplikační omezení a mít jediného vlastníka scrollu |
| Backend a frontend hlásí jinou verzi | starý runtime/OPcache nebo smíchaný balík | znovu nasadit jeden balík, reload web runtime, zkontrolovat `info.xml` a Core global |

Playground je diagnostika. Jeho nefunkčnost je chyba referenční aplikace nebo nasazení, nikoli důvod kopírovat další loader do spotřebitelských aplikací.
