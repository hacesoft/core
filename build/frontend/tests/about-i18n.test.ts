// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest'
import { about } from '../about'
import { translateAbout } from '../about-i18n'
afterEach(() => { document.documentElement.lang = '' })
const app = { id: 'hc_shared_app_core_playground', name: 'Playground', version: '1.0.0', repository: 'https://github.com/hacesoft/Playground', documentation: 'https://github.com/hacesoft/Playground#readme' }
it('renders shared About labels in English under an English account', () => {
 document.documentElement.lang = 'en-GB'
 const host = document.createElement('div')
 const controller = about.mount(host, { app, checkUpdates: false })
 for (const label of ['About application','Installed','Latest','Update check unavailable','Documentation','Release Notes']) expect(host.textContent).toContain(label)
 for (const label of ['Nainstalováno','Nejnovější','Dokumentace','Kontrola není dostupná']) expect(host.textContent).not.toContain(label)
 controller.destroy()
})
it('retains Czech and uses English for an unsupported language or unknown key', () => {
 document.documentElement.lang = 'cs-CZ'
 expect(translateAbout('Installed')).toBe('Nainstalováno')
 expect(translateAbout('Newer than published')).toBe('Novější než zveřejněná')
 document.documentElement.lang = 'ja'
 expect(translateAbout('Installed')).toBe('Installed')
 expect(translateAbout('Unknown label')).toBe('Unknown label')
})
it('translates all About labels for each supported locale and handles regional variants', () => {
 for (const locale of ['cs','de','es','fr','it','nl','pl','pt','sk','uk']) {
  document.documentElement.lang=locale+'_'+locale.toUpperCase()
  for (const label of ['About application','Installed','Latest','Current','Update available','Newer than published','Update check unavailable','Stale cached result','Map cache','Checking shared counters…','Shared counters available','Counters unavailable','Could not check counters']) {
   expect(translateAbout(label)).toBeTruthy()
   expect(translateAbout(label)).not.toBe(label)
  }
 }
})
