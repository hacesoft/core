[🇨🇿 **Česky**](../cz/API.md) | [🇬🇧 English](../en/API.md)

# API a služby

Veřejným vstupem do frontendových služeb je `window.HcSharedAppCore`. Konkrétní signatury ověřujte proti odpovídající vydané verzi a deklarovanému kontraktu API.

- `layout`, `workspace`, `dialogs`, `forms`, `notifications`, `picker`, `settings`: společné uživatelské rozhraní.
- `editor`: Markdown editor; hostitelská aplikace řídí ukládání a oprávnění.
- `maps`, `lists`: mapa, místa, hierarchické seznamy a sdílení.
- `background`: pozadí a nastavení vzhledu aplikace.
- `concurrency`: podpora revizí a zpracování konfliktu HTTP 409; atomický zápis musí implementovat backend hostitelské aplikace.

Další aplikace musí oddělit oprávnění jednotlivých uživatelů, ošetřit vstupy a nepředpokládat přístup k datům jiných aplikací.
