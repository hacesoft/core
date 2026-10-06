[🇨🇿 Česky](../README_CZ.md) | [🇬🇧 English](../README.md)

# Víceuživatelské změny a optimistic concurrency

Platí od kandidáta **Shared App Core 0.18.0-dev.12**.

Tento standard řeší situaci, kdy dva uživatelé nebo dvě okna načtou stejnou verzi objektu a později jej oba chtějí uložit. Nejde o presence, collaborative editing ani dlouhodobý zámek.

## Závazný princip

Každý sdíleně editovatelný objekt musí mít stabilní revizi. Preferovaná forma je celé nezáporné číslo `revision`, které se při každém úspěšném zápisu zvýší právě o 1.

Klient při načtení obdrží například:

```json
{
  "id": 42,
  "revision": 17,
  "title": "Router"
}
```

Při ukládání klient odešle původní revizi:

```json
{
  "expectedRevision": 17,
  "title": "Router v racku"
}
```

Server nesmí provést pouze samostatné `SELECT revision` a následný nechráněný `UPDATE`. Ověření a změna musí tvořit jeden atomický compare-and-swap krok, například:

```sql
UPDATE app_table
SET title = ?, revision = revision + 1
WHERE id = ? AND revision = ?
```

Pokud se nezmění žádný řádek, objekt byl mezitím změněn nebo odstraněn. Aplikace vrátí **HTTP 409 Conflict** a nesmí přepsat novější stav.

Stejná revize musí chránit všechny mutace jednoho objektu, nejen hlavní obsah. U Wiki například název, Markdown, rodiče ve stromu, pinning a ACL změny nesmí používat vzájemně nesouvisející kontroly `updated_at`.

## Veřejná služba Core

Frontend používá `window.HcSharedAppCore.concurrency`.

```js
const payload = core.concurrency.withExpectedRevision({
  title,
  content,
}, page.revision)

try {
  const saved = await savePage(payload)
  page.revision = saved.revision
} catch (error) {
  if (!core.concurrency.isConflict(error)) throw error

  const choice = await core.concurrency.resolveConflict({
    title: 'Konflikt změn',
    message: 'Položku mezitím změnil jiný uživatel nebo jiné okno.',
    reloadLabel: 'Načíst novou verzi',
    keepEditingLabel: 'Ponechat moje změny',
    compareLabel: 'Porovnat',          // volitelné
    saveCopyLabel: 'Uložit jako kopii' // volitelné
  })

  // Core vrací jen volbu uživatele. Načtení, porovnání a uložení kopie
  // zůstává doménovou logikou aplikace.
}
```

Veřejné metody:

- `withExpectedRevision(payload, revision)` — vytvoří nový payload a přidá `expectedRevision`; původní objekt nemění.
- `getStatus(errorOrResponse)` — získá HTTP status z běžných tvarů chyb (`status`, `response.status`, `cause.status`).
- `isConflict(errorOrResponse)` — vrací `true` pro HTTP 409.
- `resolveConflict(options)` — jednotný Core dialog; vrací `reload`, `keep-editing`, volitelně `compare` nebo `save-copy`.

Core je **finální společná klientská vrstva a UX kontrakt**, nikoli centrální databázový zámek. Serverovou atomickou kontrolu musí implementovat každá aplikace nad svými daty.


## Konzervativní sloučení textu

Od `0.18.0-dev.12` poskytuje Core také `core.concurrency.mergeText(base, local, remote)`. Je určen pro textové editory, které chtějí po HTTP 409 bezpečně sloučit změny provedené v různých částech stejného textu.

Funkce používá společnou načtenou verzi `base` a nikdy nesmí obejít serverový CAS. Pokud lokální a vzdálená změna zasahují do různých oblastí původního textu, vrátí `status: "merged"` a sloučený text. Pokud se změny překrývají nebo je nelze jednoznačně oddělit, vrátí `status: "conflict"`. Implementace je úmyslně konzervativní: falešný konflikt je přijatelný, tiché přepsání cizího textu nikoli.

```js
const result = core.concurrency.mergeText(baseContent, localContent, remoteContent)
if (result.status === 'merged') {
  editor.setValue(result.text)
  // použít revision vzdálené verze a znovu uložit přes standardní CAS
}
```

Toto není realtime collaborative editing. Uživatelé neuvidí cizí kurzor ani změny okamžitě. Umožňuje ale bezpečně dokončit souběžné úpravy rozdílných částí textu při ukládání.

## Povinné chování aplikace

1. Čtení vrací aktuální `revision`.
2. Každá mutace přijímá `expectedRevision`.
3. Úspěšná mutace zvýší revizi a vrátí novou hodnotu.
4. Zastaralá revize vrátí HTTP 409 bez částečného zápisu.
5. Klient při 409 nesmí automaticky zopakovat zápis novějšího stavu.
6. `updated_at` může zůstat pro audit/UI, ale neslouží jako jediný concurrency token.
7. Mazání sdíleného objektu musí být chráněno stejnou revizí, pokud aplikace podporuje mazání jiným uživatelem než vlastníkem.

## Povinné testy spotřebitele

Minimálně:

1. dvě okna načtou revizi 10;
2. okno A uloží a získá revizi 11;
3. okno B odešle `expectedRevision=10`;
4. server vrátí 409 a stav revize 11 zůstane beze změny;
5. po načtení nové verze může B uložit s `expectedRevision=11`;
6. stejný test proběhne pro vedlejší mutaci (např. přesun ve stromu nebo ACL), ne jen pro textový editor.

## Co tento standard neřeší

Presence („uživatel právě edituje“), heartbeat, WebSocket a společné psaní v reálném čase jsou samostatné volitelné funkce. Nextcloud file locking ani DB transakce samy o sobě nenahrazují tento aplikační konfliktový kontrakt.


## Živá synchronizace otevřeného objektu

Od `0.18.0-dev.14` může spotřebitel použít `core.concurrency.watchRevision(...)`. Jde o lehký polling revize, nikoli o zámek ani realtime transport. Výchozí interval je 2 s, na skryté kartě se polling pozastaví a při návratu na kartu nebo focusu se provede okamžitá kontrola. Aplikace má načítat pouze malý revision/state endpoint a plný objekt stáhnout až po zjištění změny.

```js
const watcher = core.concurrency.watchRevision({
  initialRevision: page.revision,
  intervalMs: 2000,
  loadRevision: async () => (await api(`/items/${page.id}/state`)).revision,
  onChange: async ({ revision }) => {
    await reloadOrMergeRemoteRevision(revision)
  },
})

// po vlastním úspěšném save:
watcher.setRevision(saved.revision)

// při zavření view:
watcher.destroy()
```

Při otevřeném editoru má aplikace zachovat aktuální režim editace. Pokud existují lokální neuložené změny, použije se třícestné `mergeText(base, local, remote)`; pouze bezpečný nekolizní merge se může automaticky propsat. Překryv změn vyžaduje konflikt workflow.
