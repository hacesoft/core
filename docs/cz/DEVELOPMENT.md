[🇨🇿 **Česky**](../cz/DEVELOPMENT.md) | [🇬🇧 English](../en/DEVELOPMENT.md)

# Vývoj aplikací využívajících Core

Core poskytuje pro další aplikace veřejné rozhraní `window.HcSharedAppCore`. Před inicializací uživatelského rozhraní ověřte dostupnost Core a kompatibilní verzi kontraktu.

Připravený příklad aplikace je v `build/examples/empty-app/`. Zdrojový TypeScript sdílených frontendových služeb je v `build/frontend/`. Instalace veřejné aplikace tyto build nástroje nevyžaduje.

Dostupné oblasti: rozvržení, pracovní plocha, dialogy, formuláře, oznámení, nastavení, Markdown editor, mapy, seznamy, sdílení a pomocné postupy pro souběžné úpravy. Integrující aplikace odpovídá za své ukládání, oprávnění a API. Nepřebírejte jeho interní databázové tabulky jako veřejné rozhraní.

```js
const core = window.HcSharedAppCore
if (!core) throw new Error('Shared App Core is required')
// Inicializujte pouze služby, které vaše aplikace používá.
```

Pro podrobné chování seznamů a sdílení použijte [API a služby](API.md).

## Podrobné návody pro vývojáře
- [Kontrakt a integrace Core](CORE_REFERENCE.md)
- [Katalog veřejných služeb](SERVICES.md)
- [Úlohy na pozadí](BACKGROUND_JOBS.md)
- [Souběžné úpravy a konflikty](CONCURRENCY.md)
