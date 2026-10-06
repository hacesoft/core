import { access, readFile } from 'node:fs/promises'

const oProject = new URL('../../', import.meta.url)
const aRequired = ['docs/START_HERE_CZ.md', 'docs/START_APLIKACE_CZ.md', 'docs/SERVICE_CATALOG_CZ.md', 'docs/LAYOUT_API_CZ.md', 'docs/MAPS_API_CZ.md', 'docs/MIGRACE_APLIKACE_CZ.md', 'docs/CORE_NC35_CZ.md', 'docs/CORE_NC35_EN.md', 'docs/BACKGROUND_JOBS_CZ.md', 'docs/BACKGROUND_JOBS_EN.md', 'docs/MULTI_USER_CONCURRENCY_STANDARD_CZ.md', 'docs/MULTI_USER_CONCURRENCY_STANDARD_EN.md', 'docs/RELEASE_ARTIFACT_POLICY_CZ.md', 'docs/RELEASE_ARTIFACT_POLICY_EN.md', 'docs/NAS_NC35_CZ.md', 'docs/NAS_NC35_EN.md', 'docs/QUALIFICATION_NC35_CZ.md', 'docs/QUALIFICATION_NC35_EN.md', 'build/examples/empty-app/frontend/main.ts', 'build/examples/empty-app/src/templates/main.php', 'build/examples/empty-app/src/lib/BackgroundJob/Heartbeat.php']
for (const sPath of aRequired) await access(new URL(sPath, oProject))

const sTemplate = await readFile(new URL('build/examples/empty-app/src/templates/main.php', oProject), 'utf8')
for (const sPart of ["Util::addStyle('hc_shared_app_core', 'workspace')", "Util::addStyle('hc_example_app', 'main')", "Util::addScript('hc_shared_app_core', 'hc_shared_app_core')", "Util::addScript('hc_example_app', 'main')"]) {
  if (!sTemplate.includes(sPart)) throw new Error('Reference template misses: ' + sPart)
}
if (/core-guard|data-core-(?:status|script|style)-url/i.test(sTemplate)) throw new Error('Reference contains obsolete dynamic Guard')

const sMain = await readFile(new URL('build/examples/empty-app/frontend/main.ts', oProject), 'utf8')
for (const sPart of ['DOMContentLoaded', 'window.HcSharedAppCore', 'assertCompatible', 'createAppLayout']) if (!sMain.includes(sPart)) throw new Error('Reference start misses: ' + sPart)
if (/HcSharedAppCoreGuard|registerApp/.test(sMain)) throw new Error('Reference registers obsolete Guard')

const sCatalog = await readFile(new URL('docs/SERVICE_CATALOG_CZ.md', oProject), 'utf8')
if (/\.layout\.create\s*\(/.test(sCatalog)) throw new Error('Catalog contains nonexistent layout.create()')
const catalogCz = await readFile(new URL('docs/CORE_NC35_CZ.md', oProject), 'utf8')
const catalogEn = await readFile(new URL('docs/CORE_NC35_EN.md', oProject), 'utf8')
for (const catalog of [catalogCz, catalogEn]) for (const symbol of ['core.lists.create', 'core.lists.addPlace', 'core.lists.share', 'core.editor.create', 'editor.destroy()', 'core.background.create', 'background.destroy()']) {
  if (!catalog.includes(symbol)) throw new Error('Missing executable API example: ' + symbol)
}

const concurrencyDoc = await readFile(new URL('docs/MULTI_USER_CONCURRENCY_STANDARD_CZ.md', oProject), 'utf8')
for (const symbol of ['core.concurrency', 'withExpectedRevision', 'watchRevision', 'expectedRevision', 'HTTP 409', 'WHERE id = ? AND revision = ?']) {
  if (!concurrencyDoc.includes(symbol)) throw new Error('Concurrency contract misses: ' + symbol)
}
const serviceCatalog = await readFile(new URL('docs/SERVICE_CATALOG_CZ.md', oProject), 'utf8')
if (!serviceCatalog.includes('concurrency')) throw new Error('Public service catalog misses concurrency')


const viteConfig = await readFile(new URL('build/vite.config.ts', oProject), 'utf8')
if (!/sourcemap:\s*false/.test(viteConfig)) throw new Error('Canonical Vite build must have sourcemap: false')
const releaseScript = await readFile(new URL('build-release.sh', oProject), 'utf8')
for (const symbol of ["*.map", 'sourceMappingURL', 'full-source ZIP', 'runtime ZIP']) {
  if (!releaseScript.includes(symbol)) throw new Error('Release artifact gate missing: ' + symbol)
}
const releasePolicy = await readFile(new URL('docs/RELEASE_ARTIFACT_POLICY_CZ.md', oProject), 'utf8')
for (const symbol of ['sourcemap: false', '*.map', 'sourceMappingURL', 'release gate']) {
  if (!releasePolicy.includes(symbol)) throw new Error('Release artifact policy misses: ' + symbol)
}

console.log('Documentation/reference contract check passed')

const startupDoc = await readFile(new URL('docs/START_APLIKACE_CZ.md', oProject), 'utf8')
for (const source of [sTemplate, sMain]) if (!startupDoc.includes(source.trimEnd())) throw new Error('Startup documentation drifted from tested reference')
for (const doc of ['MIGRATION_NC35_FOR_APPS_CZ.md', 'QUALIFICATION_NC35_CZ.md', 'AUDIT_NC35_CZ.md', 'archive/QUALIFICATION_NC34_NC35_CZ.md']) await access(new URL('docs/' + doc, oProject))


let legacyQualificationAtRoot = false
try { await access(new URL('docs/QUALIFICATION_NC34_NC35_CZ.md', oProject)); legacyQualificationAtRoot = true } catch {}
if (legacyQualificationAtRoot) throw new Error('Legacy NC34+NC35 qualification must live only under docs/archive/')

const qualificationNc35 = await readFile(new URL('docs/QUALIFICATION_NC35_CZ.md', oProject), 'utf8')
for (const symbol of ['NC35-only', 'min-version=35', 'max-version=35', 'nextcloud.min=35', 'nextcloud.max=35']) {
  if (!qualificationNc35.includes(symbol)) throw new Error('NC35 qualification contract misses: ' + symbol)
}
if (/nextcloud-test34|NC34\/PHP|rozsah\s*34[–-]35/.test(qualificationNc35)) throw new Error('Current NC35 qualification still contains an active NC34 test target')
const startHere = await readFile(new URL('docs/START_HERE_CZ.md', oProject), 'utf8')
if (!startHere.includes('QUALIFICATION_NC35_CZ.md') || startHere.includes('Provozní ověření obou verzí NC')) throw new Error('START_HERE does not point to the NC35-only qualification')
const qualifyScript = await readFile(new URL('build/scripts/qualify-container.sh', oProject), 'utf8')
if (/34\|35|34 or 35|major 34/.test(qualifyScript)) throw new Error('Qualification script still accepts NC34')
const startupTest = await readFile(new URL('build/scripts/test-startup.mjs', oProject), 'utf8')
if (/\[34,35\]|NC34\/35/.test(startupTest)) throw new Error('Current startup matrix still claims NC34')

// Current artifact policy is enforced by executable build checks.
for (const path of ['docs/RELEASE_ARTIFACT_POLICY_CZ.md','docs/RELEASE_ARTIFACT_POLICY_EN.md']) {
  const policy = await readFile(new URL(path, oProject), 'utf8')
  if (!policy.includes('.map')) throw new Error('Artifact policy must document source-map exclusion')
}
