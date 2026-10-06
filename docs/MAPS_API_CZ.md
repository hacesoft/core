[🇨🇿 Česky](../README_CZ.md) | [🇬🇧 English](../README.md)

# Maps API a sdílená cache

Aplikace používá URL z `core.maps.tileTemplate(...)` nebo mapu vytvořenou přes veřejné Maps API. Externí tile URL ani provider klíč neskládá sama.

Core ukládá dlaždice do sdíleného souborového úložiště; instalace nové verze Core cache nemaže. Redis slouží jen pro krátkodobé čítače, koordinaci a ochranu souběhu. Cache hit se nepočítá do externího limitu.

Odpovědi `429` a `503` nejsou obrázek. Mapový klient musí respektovat `Retry-After`, zrušit zastaralé požadavky při rychlém posunu a znovu zkusit jen stále viditelné dlaždice. Core 0.16.1 má provozní limit nastavený tak, aby běžný i intenzivní pohyb mapy nezastavoval vykreslování; ochrana je určena pro mimořádné přetížení, ne pro normální práci.

Správce může jednotný dialog otevřít:

```js
const dialog = core.maps.cache.openSettings()
```

Dialog zobrazuje skutečnou velikost, zaplnění, hit/miss, externí požadavky, chyby, poskytovatele a TTL. Změna je globální pro všechny aplikace. Mazání cache musí být výslovná administrátorská akce.

## Poloha zařízení (od 0.17.0)

`maps.watchLocation()` poskytuje proud polohy, `maps.followLocation()` následování mapou. Úplný kontrakt, příklady a povinné propojení ručního panu: [MAPS_LOCATION_CZ.md](MAPS_LOCATION_CZ.md).
