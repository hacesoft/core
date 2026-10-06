[🇨🇿 Česky](../README_CZ.md) | [🇬🇧 English](../README.md)

# Layout API

Každá aplikace musí mít jediného vlastníka výšky a scrollu. Pro novou kostru použijte `createAppLayout`; při migraci existujícího DOM lze použít `observe`. Mapu nebo graf vložte do `createSurface`, textový obsah do `createScrollArea`.

Core řeší dostupnou výšku, změnu viewportu, orientaci, split-screen a resize události. Aplikace řeší vlastní obsah a při `onResize` přepočítá mapu, canvas či graf.

Zakázané jsou souběžné výškové mechanismy (`100vh` plus vlastní JS výpočet plus Core observer), globální `overflow: hidden` bez jasného vlastníka a `touch-action: pan-y`, které po přiblížení blokuje vodorovný pohyb. Kontrolujte také aplikační `preventDefault()`.

```js
const controller = core.layout.observe(root, {
  onResize: () => map?.invalidateSize?.(),
})
const onPageHide = (event) => {
  if (event.persisted) return
  window.removeEventListener('pagehide', onPageHide)
  controller.destroy()
}
window.addEventListener('pagehide', onPageHide)
```
