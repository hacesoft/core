// Execute the real compiled reference consumer against the real bundle in jsdom.
import fs from 'node:fs'
import assert from 'node:assert/strict'
import {JSDOM} from 'jsdom'
const core=fs.readFileSync(new URL('../../src/js/hc_shared_app_core.js',import.meta.url),'utf8')
const app=fs.readFileSync(new URL('../examples/empty-app/src/js/main.js',import.meta.url),'utf8')
for(const major of [35])for(const scenario of ['ok','missing','old','api-mismatch']) {
 const dom=new JSDOM('<div id="hc_example_app" data-required-core-version="0.18.0-dev.2" data-required-core-api-version="1"></div>',{url:'https://test.invalid/nc/',runScripts:'outside-only',pretendToBeVisual:true})
 const w=dom.window;w.ResizeObserver=class {observe(){} disconnect(){}};w.OC={config:{version:major+'.0.0'}}
 if(scenario!=='missing') w.eval(core)
 if(scenario==='old')w.HcSharedAppCore={...w.HcSharedAppCore,version:'0.17.0',assertCompatible(){throw new Error('Shared App Core is outdated')}}
 if(scenario==='api-mismatch')w.HcSharedAppCore={...w.HcSharedAppCore,apiVersion:2}
 w.eval(app);w.document.dispatchEvent(new w.Event('DOMContentLoaded'))
 assert.equal(!!w.document.querySelector('.hc-example-app'),scenario==='ok',major+': '+scenario)
 if(scenario!=='ok')assert.ok(w.document.querySelector('[role="alert"] a'))
 dom.window.close()
}
console.log('Real reference bootstrap: 4 simulated NC35 success/failure cases PASS; not a server test')
