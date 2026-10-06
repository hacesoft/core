[🇨🇿 Česky](../README_CZ.md) | [🇬🇧 English](../README.md)

# Závazný standard startu a Core Guard

Od 0.16.1 je Guard krátká kontrola v aplikaci. **Žádný samostatný core-guard.js, dynamický loader, startup retry ani /status polling.** NC35 tento model nemění. Neutrální root je dovolen; rychlý start nemusí ukázat loading. Nepřidávejte umělé zdržení ani falešné hlášení „Core chybí“ před spuštěním aplikace.

PHP pořadí je Core CSS → CSS aplikace → Core JS → JS aplikace. Bundle nenačítejte druhou cestou. Nextcloud spravuje URL/verzování assetů; nepřidávejte vlastní pevný ?v ani private oc_appswebroots. Hlavní aplikace po DOM ready ověří globál, API major a minimum Core ze svého manifestu. Chyba blokuje mount; vlastní root CSS třída se přidává až při úspěšném mountu.

Následující dva bloky jsou přesnou kopií testované reference; kontrola dokumentace hlídá jejich shodu. PHP hodnoty dodává PageController přímo z manifestu. Pracovní minimum 0.18.0-dev.1 slouží jen kvalifikaci; stabilní minimum bude stanoveno vydáním.

## Šablona

```php
<?php

declare(strict_types=1);

use OCP\Util;

// Nextcloud zajistí deterministické pořadí: Core styly, aplikace, Core JS, aplikace JS.
Util::addStyle('hc_shared_app_core', 'workspace');
Util::addStyle('hc_example_app', 'main');
Util::addScript('hc_shared_app_core', 'hc_shared_app_core');
Util::addScript('hc_example_app', 'main');
?>
<div
    id="hc_example_app"
    data-app-version="<?php p($_['appVersion']); ?>"
    data-required-core-version="<?php p($_['requiredCoreVersion']); ?>"
    data-required-core-api-version="<?php p($_['requiredCoreApiVersion']); ?>"
    data-core-download-url="<?php p($_['coreDownloadUrl']); ?>"
></div>
```

## Aplikační vstup (TypeScript)

Typový import je při sestavení odstraněn; Core runtime se nikdy nepřibaluje do aplikace. Cesta importu je relativní vůči referenci v tomto balíku.

```ts
import type {} from '../../../frontend/index'

const fShowError = (oRoot: HTMLElement, sMessage: string): void => {
  const oPanel = document.createElement('section')
  oPanel.setAttribute('role', 'alert')
  const oTitle = document.createElement('h1'); oTitle.textContent = 'Aplikaci nelze spustit'
  const oText = document.createElement('p'); oText.textContent = sMessage
  const oLink = document.createElement('a'); oLink.href = 'https://github.com/hacesoft/hc-shared-app-core/releases'; oLink.textContent = 'Stáhnout Shared App Core'
  oPanel.append(oTitle, oText, oLink); oRoot.replaceChildren(oPanel)
}

const fStart = (): void => {
  const oRoot = document.getElementById('hc_example_app')
  if (!oRoot) return
  const oCore = window.HcSharedAppCore
  if (!oCore) { fShowError(oRoot, 'Shared App Core není nainstalované, povolené nebo se nepodařilo načíst.'); return }
  try {
    if (oCore.apiVersion !== Number(oRoot.dataset.requiredCoreApiVersion)) throw new Error('Nekompatibilní API Shared App Core.')
    oCore.assertCompatible(oRoot.dataset.requiredCoreVersion ?? '')
  }
  catch (oError) { fShowError(oRoot, oError instanceof Error ? oError.message : 'Shared App Core není kompatibilní.'); return }
  const aCleanup: Array<() => void> = []
  oRoot.classList.add('hc-example-app')
  const oLayout = oCore.layout.createAppLayout(oRoot, { header: 'Ukázková aplikace', ariaLabel: 'Ukázková aplikace' })
  aCleanup.push(() => oLayout.destroy())
  oCore.about.register({ id: 'hc_example_app', name: 'Ukázková aplikace', version: oRoot.dataset.appVersion ?? '1.0.0', repository: 'https://github.com/hacesoft/hc-shared-app-core' })
  const oToolbar = oCore.toolbar.create(oLayout.elements.toolbar, {
    actions: [
      { id: 'about', label: 'O aplikaci', onClick: () => {
        const oHost = document.createElement('div')
        const oAbout = oCore.about.mount(oHost, { checkUpdates: false })
        const oDialog = oCore.dialogs.open({ title: 'O aplikaci', content: oHost, actions: [{ label: 'Zavřít' }] })
        void oDialog.closed.then(() => oAbout.destroy())
        aCleanup.push(() => { oDialog.close(); oAbout.destroy() })
      } },
      { id: 'cache', label: 'Mapová cache', onClick: () => { const oDialog = oCore.maps.cache.openSettings(); aCleanup.push(() => oDialog.close()) } },
      { id: 'confirm', label: 'Ukázka potvrzení', onClick: async () => {
        const bAccepted = await oCore.dialogs.confirm({ title: 'Potvrzení', message: 'Potvrdit ukázkovou akci?' })
        if (document.contains(oRoot) && bAccepted) oCore.notifications.success('Akce potvrzena.')
      } },
    ],
  })
  aCleanup.push(() => oToolbar.destroy())
  const oContent = oCore.layout.createScrollArea()
  const oText = document.createElement('p')
  oText.textContent = `Aplikace je spuštěna. Core ${oCore.version}, API ${oCore.apiVersion}.`
  oContent.append(oText)
  oLayout.elements.content.append(oContent)
  const onPageHide = (event: PageTransitionEvent): void => {
    if (event.persisted) return
    window.removeEventListener('pagehide', onPageHide)
    for (const fn of aCleanup.splice(0).reverse()) fn()
  }
  window.addEventListener('pagehide', onPageHide)
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fStart, { once: true })
else fStart()
```

Při skutečném unmountu ukončete i vlastní síťové požadavky, GPS, časovače a listenery. BFCache pagehide persisted=true není zničení aplikace. Core range kontroluje instalátor a Nextcloud metadata; assertCompatible kontroluje minimum Core, nikoli verzi hostitele. Starý Core na NC35 nelze napravovat jeho force-enable; nová aplikace se správným minimem jej odmítne.
