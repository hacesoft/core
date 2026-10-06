[🇨🇿 Česky](../README_CZ.md) | [🇬🇧 English](../README.md)

# Editor a jednotné vykreslení Markdownu

Platí od kandidáta **0.18.0-dev.12**.

## Závazný princip

Shared App Core vlastní základní Markdown parser/renderovací kontrakt. Spotřebitelská aplikace nesmí kvůli odlišnému vzhledu živého náhledu vytvořit paralelní Markdown renderer. Živý náhled editoru i čtecí/náhledový režim aplikace musí používat `core.editor.render()` a společnou CSS třídu `hc-core-markdown`.

Editor sám přidává `hc-core-markdown` na svůj živý preview panel. Hostitelská aplikace přidá stejnou třídu na svůj read/preview kontejner a vloží do něj výsledek `core.editor.render()`.

```js
const fragment = core.editor.render(markdown, resolveImageUrl)
decoratePreview(fragment, markdown)
preview.replaceChildren(fragment)
preview.classList.add('hc-core-markdown')
```

## Rozšíření syntaxe aplikací

Aplikace může potřebovat vlastní bezpečnou nadstavbu, například Home Wiki `[[stránka]]`. Kvůli tomu nesmí nahradit celý renderer. Použije `decoratePreview(fragment, markdown)`, který dostane již bezpečně vytvořený DOM fragment a smí jej doplnit DOM operacemi. Nesmí vkládat neověřené HTML přes `innerHTML`.

Stejný dekorátor se předá `core.editor.create()` i `core.editor.render()`. Tím se vlastní syntaxe chová shodně v živém náhledu i v čtecím režimu.

## Povinný regresní test spotřebitele

Stejný Markdown dokument s nadpisy, odstavci, tabulkou, citací, seznamem, obrázkem a aplikačním rozšířením se vykreslí v živém preview a v read/preview režimu. DOM struktura a společné typografické CSS musí odpovídat. Rozdíl způsobený pouze velikostí kontejneru je přípustný; rozdílný parser nebo typografie není.
