import { readFile } from 'node:fs/promises'
import vm from 'node:vm'

const source = await readFile(new URL('../../src/js/hc_shared_app_core.js', import.meta.url), 'utf8')
const browser = { console }
browser.window = browser
vm.runInNewContext(source, browser)

const core = browser.HcSharedAppCore
for (const method of ['watchLocation', 'followLocation']) {
  if (typeof core?.maps?.[method] !== 'function') throw new Error('Missing maps.' + method)
}
if (!core || core.version !== '0.18.1' || core.apiVersion !== 1 || !core.layout || !core.about || !core.updates || !core.maps || !core.maps.favorites || !core.maps.providers || !core.maps.diagnostics || !core.maps.cache || typeof core.maps.cache.openSettings !== 'function' || !core.concurrency || typeof core.concurrency.withExpectedRevision !== 'function' || typeof core.concurrency.isConflict !== 'function' || typeof core.concurrency.resolveConflict !== 'function' || typeof core.concurrency.watchRevision !== 'function') {
  throw new Error('Built bundle does not publish the expected Core identity.')
}

for (const member of ['assertCompatible', 'events', 'config', 'logger', 'workspace', 'dialogs', 'notifications', 'toolbar', 'forms', 'settings', 'picker']) {
  if (core[member] === undefined) {
    throw new Error('Built bundle is missing public member: ' + member)
  }
}

core.assertCompatible('0.1.0')
console.log('Bundle smoke test passed: window.HcSharedAppCore ' + core.version)

for (const [owner, methods] of [
 [core.layout,['observe','createAppLayout','createView','createPanel','createScrollArea','createSplitView','createSurface']],
 [core.maps,['mount','tileTemplate','watchLocation','followLocation']],
 [core.maps.favorites,['list','add','update','remove']],
 [core.about,['register','mount']],
]) for(const method of methods) if(typeof owner[method] !== 'function') throw Error('Documented public method missing: '+method)
if ('create' in core.layout) throw Error('Unexpected layout.create API')
