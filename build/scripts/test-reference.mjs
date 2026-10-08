import { readFile } from 'node:fs/promises'
import vm from 'node:vm'

const sCore = await readFile(new URL('../../src/js/hc_shared_app_core.js', import.meta.url), 'utf8')
const oBrowser = { console }
oBrowser.window = oBrowser
vm.runInNewContext(sCore, oBrowser)
if (!oBrowser.HcSharedAppCore || oBrowser.HcSharedAppCore.version !== '0.18.2') throw new Error('Core bundle cannot start before a consumer')
oBrowser.HcSharedAppCore.assertCompatible('0.18.0-dev.2')
if (!oBrowser.HcSharedAppCore.concurrency || typeof oBrowser.HcSharedAppCore.concurrency.isConflict !== 'function' || typeof oBrowser.HcSharedAppCore.concurrency.watchRevision !== 'function') throw new Error('Core concurrency API is missing')
console.log('Core simple-start prerequisite: PASS')
