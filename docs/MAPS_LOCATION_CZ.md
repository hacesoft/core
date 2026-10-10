[🇨🇿 Česky](../README_CZ.md) | [🇬🇧 English](../README.md)

# Poloha a následování mapou

Nové veřejné služby `maps.watchLocation()` a `maps.followLocation()` jsou doplňkové. Stávající aplikace nevyžadují změnu startu. Aplikace používající tyto služby musí deklarovat minimum Core 0.18.4. API verze zůstává 1.

## Zapojení

`map` je controller vrácený `core.maps.mount()`. Sledování spouštějte po akci uživatele; prohlížeč vyžaduje bezpečný kontext a povolení polohy. Core nezapisuje polohu do cache ani na server.

```js
const core = window.HcSharedAppCore;
let tracker, follow;
function startLocation(map) {
  stopLocation();
  tracker = core.maps.watchLocation({
    enableHighAccuracy: true,
    timeoutMs: 10000,
    maximumAgeMs: 5000,
    minIntervalMs: 1000,
    minDistanceM: 2,
    onPosition(sample) { updateLocationMarker(sample.point); },
    onError(error) { showLocationError(error.code); }
  });
  follow = core.maps.followLocation(map, tracker, {
    keepZoom: true,
    disableOnManualPan: true,
    recenterOnStart: true
  });
}
function stopLocation() {
  follow?.destroy();
  tracker?.destroy();
  follow = tracker = undefined;
}
// Tlačítko Moje poloha po zahájení sledování:
function recenter() { follow?.enable(); }
// Skutečný ruční pan mapového adaptéru:
function onUserPan(map) { map.notifyManualPan(); }
// Při skutečném unmountu aplikace zavolejte stopLocation().
```

`updateLocationMarker` a `showLocationError` jsou aplikační callbacky, nikoli služby Core. Před zničením mapy ukončete vlastní tracker. Samotné zničení mapy odpojí follow, ale nezničí tracker, který může mít další odběratele. Při BFCache (`pagehide.persisted`) neničte aplikaci bez odpovídající obnovy na `pageshow`.

## Kontrakt trackeru

Výchozí hodnoty: high accuracy true, timeout 10000 ms, maximumAge 5000 ms, minInterval 0 ms, minDistance 0 m. Časové a vzdálenostní parametry musí být konečná nezáporná čísla. Volitelný `signal: AbortSignal` zastaví sledování při abortu; předem zrušený signal GPS vůbec nespustí.

Každý vzorek obsahuje `point: {lat, lon}`, `timestamp` v milisekundách od epochy a `accuracyM`, `altitudeM`, `altitudeAccuracyM`, `headingDeg`, `speedMps`. Nedostupné doplňkové hodnoty jsou null. Vzorek i point jsou neměnné. První platný vzorek je doručen ihned. Další musí mít novější timestamp a splnit oba filtry vůči poslednímu doručenému vzorku. Filtry omezují doručování aplikaci, nikoli frekvenci měření GPS; nejde o garantovanou úsporu baterie.

- `getLast()` vrací poslední doručený vzorek nebo null.
- `subscribe(callback)` přidá odběratele budoucích vzorků a vrátí odpojení. Aktuální vzorek získejte přes getLast().
- `stop()` provede skutečný clearWatch(), je opakovatelné a ponechá poslední vzorek. Pro nové spuštění vytvořte nový tracker.
- `destroy()` navíc odstraní odběratele a poslední vzorek; je opakovatelné.
- `onError` dostává `{code, message}`. Kódy: permission_denied, position_unavailable, timeout, unsupported. Zamítnutí oprávnění a nepodporovaný prohlížeč sledování ukončí; timeout a nedostupná poloha se oznámí, existující watch zůstává. Core nevytváří opakovací smyčku žádostí o oprávnění.

## Následování a události

Follow začíná zapnuté. `enable()` vystředí na poslední známou polohu; `disable()` ponechá GPS běžet; `isEnabled()` vrací stav. `destroy()` odpojí všechny vlastní odběry a nemění životnost trackeru.

| Akce | Stav následování |
|---|---|
| Nová poloha | Při zapnutí posune střed |
| Zoom | Zachová aktuální stav |
| Ruční pan + notifyManualPan() | Vypne, pokud disableOnManualPan není false |
| Moje poloha / enable() | Zapne a vystředí |
| Změna vrstvy nebo provideru | Zachová aktuální stav |
| Programové setCenter() | Nevypne následování |

Mapový driver sám nerozlišuje původ pohybu. Je POVINNÉ propojit jeho skutečnou uživatelskou pan událost s `map.notifyManualPan()`. Nepřipojujte obecnou `move`/`moveend`, protože vzniká i při zoomu nebo programovém vystředění. Starší aplikace musí toto propojení doplnit; samotný upgrade Core jejich vlastní mapový adaptér nezmění.

Core controller nově nabízí `setCenter(point, zoom?)`, `notifyManualPan()` a události `manualPan`, `locationRequested`, `destroyed`. Vestavěné `locate()` vyšle locationRequested a provede svůj jednorázový dotaz na polohu. Při kontinuálním trackeru lze tlačítko aplikace připojit přímo na `follow.enable()` bez dalšího jednorázového dotazu.

`keepZoom: true` zachovává aktuální zoom. Při false se při následování používá zoom zachycený při vytvoření follow. `recenterOnStart: false` přeskočí pouze okamžité vystředění na již známý vzorek, nikoli následné nové polohy.

## Ověření

Playground má sekci Sledování polohy zařízení: GPS se aktivuje tlačítkem, testovací viewport ověřuje ruční pan a zoom bez čerpání mapových kreditů. Testy s náhradním GPS ověřují filtry, clearWatch, abort, zamítnutí oprávnění a odpojení follow. Skutečné GPS, oprávnění a uspávání mobilního prohlížeče je nutné ověřit na zařízení.

Podklad pro chování prohlížeče: [W3C Geolocation](https://www.w3.org/TR/geolocation/).
