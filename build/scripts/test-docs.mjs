import { access, readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
const root = new URL('../../', import.meta.url)
const topics = ['README', 'INSTALLATION', 'DEVELOPMENT', 'API', 'TROUBLESHOOTING', 'CORE_REFERENCE', 'SERVICES', 'BACKGROUND_JOBS', 'CONCURRENCY']
for (const topic of topics) for (const [lang, other] of [['cz', 'en'], ['en', 'cz']]) {
 const file = `docs/${lang}/${topic}.md`
 const body = await readFile(new URL(file, root), 'utf8')
 assert.ok(body.includes(`../${other}/${topic}.md`), `Missing opposite-language link: ${file}`)
}
for (const file of ['build/examples/empty-app/frontend/main.ts', 'build/examples/empty-app/src/templates/main.php', 'build/examples/empty-app/src/lib/BackgroundJob/Heartbeat.php']) await access(new URL(file, root))
const main = await readFile(new URL('build/examples/empty-app/frontend/main.ts', root), 'utf8')
for (const term of ['DOMContentLoaded', 'window.HcSharedAppCore', 'assertCompatible', 'createAppLayout']) assert.ok(main.includes(term), `Reference missing ${term}`)
const template = await readFile(new URL('build/examples/empty-app/src/templates/main.php', root), 'utf8')
for (const term of ["Util::addStyle('hc_shared_app_core', 'workspace')", "Util::addScript('hc_shared_app_core', 'hc_shared_app_core')"]) assert.ok(template.includes(term), `Reference missing ${term}`)
for (const lang of ['cz','en']) {
 const ref = await readFile(new URL(`docs/${lang}/CORE_REFERENCE.md`,root),'utf8')
 for (const term of ['core.lists.create','core.editor.create','core.background.create']) assert.ok(ref.includes(term),`Missing API example ${lang}/${term}`)
}
const vite = await readFile(new URL('build/vite.config.ts', root), 'utf8')
assert.match(vite, /sourcemap:\s*false/)
console.log('Public bilingual docs and reference application: PASS')
