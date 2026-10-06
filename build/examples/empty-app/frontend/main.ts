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
