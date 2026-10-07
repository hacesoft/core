[🇨🇿 Česky](../../README_CZ.md) | [🇬🇧 English](../../README.md)

# Shared App Core pro Nextcloud 35 — veřejné API

Core `0.18.1` poskytuje společné služby aplikacím Hacesoft na Nextcloud 35. Instalační balík obsahuje sestavené soubory i zdrojový kód.


## Jediný katalog

| Služba | Veřejný vstup |
| --- | --- |
| Spuštění | kostra `build/examples/empty-app`, `window.HcSharedAppCore` |
| Layout, dialogy, formuláře, oznámení, picker, nastavení | `layout`, `workspace`, `dialogs`, `forms`, `notifications`, `picker`, `settings` |
| Mapová proxy/cache/GPS | `maps`, `maps.favorites` |
| Vnořené seznamy, místa a sdílení | `lists` |
| Editor | `editor` |
| Společné pozadí aplikací | `background` |
| Správa úloh na pozadí | postup v `BACKGROUND_JOBS_CZ.md` |


## Seznamy a práva

`lists` používá prostor aplikace (`namespace`), seznamy s `position`, `archived`, volitelným `parent_id`, vlastníka a sdílení na uživatele nebo skupinu s `read`/`edit`. Existující seznamy bez rodiče zůstávají kořenové; místa se nepřepisují. Rodič musí mít stejného vlastníka a prostor; přesun pod sebe nebo potomka se odmítne. Strom z vrácených `parent_id` sestaví aplikace.

`read` čte seznam a jeho místa, `edit` mění seznam i místa, vlastník navíc upravuje sdílení a rodiče. Sdílení rodiče dědí podseznamy a jejich místa; přímé sdílení podseznamu může přístup rozšířit. Při překryvu oprávnění má `edit` přednost. Archivaci respektuje rozhraní; server zatím neblokuje zápis do archivovaných seznamů. Fyzické mazání seznamu není součástí API.

```ts
const core = window.HcSharedAppCore
const list = await core.lists.create('map_places', 'Výlet', 10)
const child = await core.lists.create('map_places', 'Praha', 0, list.id)
await core.lists.addPlace('map_places', child.id, {
  name: 'Praha', lat: 50.087, lon: 14.421, note: '', color: '#3388ff', position: 0,
})
await core.lists.share('map_places', list.id, 'group', 'turiste', 'read')
const places = await core.lists.places('map_places', child.id)
await core.lists.update('map_places', child.id, { parent_id: null }) // přesun na kořen
await core.lists.movePlace('map_places', child.id, places[0].id, list.id)
await core.lists.sharePlace('map_places', list.id, places[0].id, 'user', 'jana', 'edit')
const directlySharedWithMe = await core.lists.sharedPlaces('map_places')
```

Sdílení jednotlivého místa neodhalí ostatní místa jeho soukromého seznamu. Příjemce uvidí jeho `list_id` potřebné pro úpravu, nikoli obsah celého seznamu. Seznamy sdílené celé získá přes `lists.list`/`lists.places`; `sharedPlaces` vrací jen jednotlivě sdílená místa mimo dostupné seznamy. Sdílení místa smí spravovat pouze vlastník seznamu. `movePlace` přesouvá místo jen mezi seznamy téhož vlastníka a zachová ID i přímá sdílení. Volitelné `favorite` (boolean) a `icon` se ukládají do dat místa. Fyzické mazání seznamu zatím veřejné API nenabízí.

Při prvním `lists.list('map_places')` se starší osobní `map:favorites` jednorázově zkopírují do „Imported favorites“. Původní JSON zůstává pro návrat zpět. Staré `maps.favorites` a nové `lists` jsou během přechodu **dva oddělené zápisy**; aplikace musí přejít na nový kontrakt jako celek, jinak se pozdější změny automaticky nesynchronizují. Migraci ověřte na záloze uživatelských dat před přechodem aplikací.

## Editor

```ts
const editor = core.editor.create(hostElement, {
  value: markdownFromYourApp,
  onChange: text => { draft = text },
})
const markdownToSave = editor.getValue()
editor.destroy()
```

Vybraný text lze tlačítkem Bold/Italic zapnout a vypnout. Bez výběru se vloží dvojice značek pro další psaní; druhé kliknutí za napsaným textem přesune kurzor za formátování. Fungují také Ctrl/Cmd+B a Ctrl/Cmd+I. Tlačítka pro odkaz a URL obrázku si vyžádají adresu, obyčejný text se vkládá standardně ze schránky. PNG/JPEG/GIF/WebP ze schránky nebo z výběru souboru uloží hostitelská aplikace přes `uploadImage: async file => url`; musí přitom vynutit práva dokumentu a vrátit povolenou URL přílohy. Volitelně `embedImages: true` vloží obrázek do Markdownu jako base64 (max. 1 MiB); dokument výrazně naroste a stránka musí povolit `data:` v image CSP. Tento režim je zapnutý pouze v neukládané ukázce Playgroundu. Náhled tvoří DOM uzly bez vyhodnocení uživatelského HTML a odmítá SVG/data odkazy i nebezpečné protokoly. Ukládání a oprávnění patří aplikaci.

## Pozadí aplikace

```ts
const background = core.background.create(hostElement, coreSettingsUrl, 'moje_aplikace_vzhled')
await background.load() // nastavení aktuálního uživatele
await background.save({ mode: 'gradient', color: '#b8dbf6' })
background.destroy()
```

Veřejné režimy jsou `none`, `solid`, `gradient` a `image` s HTTPS URL bez přihlašovacích údajů. Core používá existující službu `settings`; každá aplikace musí zvolit vlastní namespace. Vlastní soubory obrázků, oprávnění a přesné vzhledy stávajících aplikací vyžadují jejich zdroje. Toto základní nastavení není jejich hotovou migrací.


Živý náhled a čtecí náhled spotřebitele mají používat stejný `core.editor.render()` a `hc-core-markdown`. Aplikační syntaxi doplňuje `decoratePreview`; aplikace nemá vytvářet paralelní Markdown parser. U samostatného `editor.render()` se dekorátor zavolá nad vráceným fragmentem. Viz `EDITOR_RENDERING_CZ.md`.


Veřejné `core.concurrency` sjednocuje klientský revision/409 workflow a konflikt dialog. Serverová compare-and-swap kontrola zůstává povinností spotřebitele. Core jednotkové testy ověřují revision payload, rozpoznání 409 a volby dialogu; provozní multi-user test se provádí v konkrétní aplikaci.
