// Run in the signed-in candidate Playground console. Read-only HTTP smoke check.
// Does not print tokens, settings contents, keys or favorite locations.
(async () => {
  const root = document.getElementById('hc_shared_app_core_playground')
  if (!root?.dataset.coreStatusUrl) throw Error('Open the candidate Playground first.')
  const base = new URL(root.dataset.coreStatusUrl, location.href)
  if (base.origin !== location.origin || !base.pathname.endsWith('/status')) throw Error('Unexpected status URL.')
  base.pathname = base.pathname.slice(0, -'status'.length); base.search = ''
  const results = []
  const read = async (path, validate) => {
    const response = await fetch(new URL(path, base), {credentials:'same-origin', cache:'no-store', signal:AbortSignal.timeout(15000), headers:{Accept:'application/json'}})
    if (!response.ok) throw Error(path + ': HTTP ' + response.status)
    const data = await response.json()
    if (!validate(data, response)) throw Error(path + ': invalid contract')
    results.push({test:path,result:'PASS'})
    return data
  }
  try {
    const status = await read('status', (d,r) => d.app === 'hc_shared_app_core' && d.contract === 'hc-shared-app-core-v1' && d.apiVersion === 1 && d.nextcloud?.min === 35 && d.nextcloud?.max === 35 && d.installedVersion === d.version && /no-store/.test(r.headers.get('Cache-Control') || ''))
    const core = window.HcSharedAppCore
    if (!core || core.apiVersion !== status.apiVersion || core.version !== status.version) throw Error('Frontend/backend mismatch')
    core.assertCompatible(root.dataset.requiredCoreVersion)
    await read('maps/providers', d => Array.isArray(d.providers))
    await read('maps/runtime', d => d.backend === 'redis' && d.available === true && d.externalRequestsAllowed === true && d.tileStorage === 'shared-filesystem-v2')
    await read('maps/diagnostics', d => Number.isFinite(d.cacheBytes) && Number.isFinite(d.cacheEntryCount))
    await read('map-favorites', d => Array.isArray(d.items))
    await read('settings?namespace=hc_shared_app_core_playground', d => typeof d.values === 'object' && d.values !== null)
    await read('sharees?query=nc35-qualification-no-match', d => Array.isArray(d.items))
    results.push({test:'runtime release',result:status.version + ' / ' + (status.qualification || 'unspecified')})
  } catch (error) {results.push({test:'failure',result:String(error)})}
  console.table(results)
  return results
})()
