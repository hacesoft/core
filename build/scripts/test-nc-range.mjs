import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
const root=path.resolve(import.meta.dirname,'../..')
const text=p=>fs.readFileSync(path.join(root,p),'utf8')
for(const file of ['src/appinfo/info.xml','build/examples/empty-app/src/appinfo/info.xml']) {
 const xml=text(file);assert.match(xml,/<nextcloud min-version="35" max-version="35"\s*\/>/)
}
const app=text('src/lib/AppInfo/Application.php')
assert.match(app,/NEXTCLOUD_MIN = 35/);assert.match(app,/NEXTCLOUD_MAX = 35/)
const status=text('src/lib/Controller/ApiController.php')
assert.match(status,/'min' => Application::NEXTCLOUD_MIN, 'max' => Application::NEXTCLOUD_MAX/)
assert.match(status,/'contract' => 'hc-shared-app-core-v1'/)
assert.match(status,/Cache-Control.*no-store/)
const blockedPHP=/OCP\\Remote\\|IPreview::registerProvider|AutoCompleteEvent\b|OC\\Hooks\\Emitter|Doctrine\\DBAL|->setOptions\s*\(|Type::lookupName|OC\\Core\\Command/
const removedJS=/\b(?:oc_appswebroots|oc_config|oc_current_user|oc_debug|oc_defaults|oc_isadmin|oc_requesttoken|oc_webroot|OCDialogs|ClipboardJS)\b|\b(?:window\.)?(?:moment|dav|Clipboard|_)\s*\./
function scan(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){
 if(['node_modules','tests'].includes(e.name))continue
 const p=path.join(dir,e.name)
 if(e.isDirectory())scan(p)
 else if(/\.(php|ts|vue)$/.test(p)&&!p.endsWith('.test.ts')) {
 const s=fs.readFileSync(p,'utf8');assert.ok(!(p.endsWith('.php')?blockedPHP:removedJS).test(s),'Removed/private API: '+p)
 }
}}
scan(path.join(root,'src/lib'));scan(path.join(root,'build/frontend'));scan(path.join(root,'build/examples/empty-app'))
for(const file of ['src/appinfo/info.xml','build/composer.json'])assert.match(text(file),/8\.2/)

const browserQualification=text('build/tests/browser/nc35-qualification.js')
assert.match(browserQualification,/nextcloud\?\.min === 35 && d\.nextcloud\?\.max === 35/)
const qualifyScript=text('build/scripts/qualify-container.sh')
assert.ok(!/34\|35|34 or 35|major 34/.test(qualifyScript),'Qualification script must be NC35-only')
const qualificationDoc=text('docs/QUALIFICATION_NC35_CZ.md')
assert.match(qualificationDoc,/min-version=35/);assert.match(qualificationDoc,/max-version=35/)

console.log('NC35 metadata/status/static/qualification-range checks: PASS (not runtime qualification)')
