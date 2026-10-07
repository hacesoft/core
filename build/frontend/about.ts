import { maps } from './maps'
import { CORE_VERSION, isVersionAtLeast } from './version'

export type UpdateState = 'current' | 'update-available' | 'ahead' | 'unavailable'

export interface ComponentInfo {
  id: string
  name: string
  version: string
  repository: string
  releaseNotes?: string
  documentation?: string
}

export interface ApplicationRegistration extends ComponentInfo {
  core?: string
}

export interface UpdateResult extends ComponentInfo {
  current: string
  latest: string | null
  latestVersion: string | null
  latestUrl: string
  state: UpdateState
  updateAvailable: boolean
  checkedAt: number | null
  cached: boolean
  stale: boolean
  source: string | null
  sourceUrl: string | null
  fileName: string | null
}

export interface UpdateSummary {
  app: UpdateResult
  core: UpdateResult
}

export interface UpdateCheckOptions extends ComponentInfo {
  endpoint?: string
  refresh?: boolean
}

export interface AboutOptions {
  app?: ComponentInfo
  requiredCoreVersion?: string
  coreRepository?: string
  endpoint?: string
  heading?: string
  checkUpdates?: boolean
  showMapsRuntime?: boolean
}

export interface AboutController {
  readonly element: HTMLElement
  refresh(): Promise<UpdateSummary>
  destroy(): void
}

interface ReleaseResponse {
  available?: boolean
  version?: string
  url?: string
  checkedAt?: number
  cached?: boolean
  stale?: boolean
  source?: string
  sourceUrl?: string
  fileName?: string
}

const sDefaultCoreRepository = 'https://github.com/hacesoft/core'
let oRegisteredApplication: Readonly<ApplicationRegistration> | null = null

const repositorySlug = (sRepository: string): string => {
  const oMatch = /^https:\/\/github\.com\/(hacesoft\/[A-Za-z0-9_.-]+?)(?:\.git|\/)?$/.exec(sRepository.trim())
  if (!oMatch?.[1]) throw new Error('Unsupported GitHub repository: ' + sRepository)
  return oMatch[1]
}

const releaseEndpoint = (sEndpoint?: string): string => {
  if (sEndpoint) return sEndpoint
  const oWindow = window as Window & { OC?: { generateUrl?: (path: string) => string } }
  return oWindow.OC?.generateUrl?.('/apps/hc_shared_app_core/api/v1/release') ?? '/apps/hc_shared_app_core/api/v1/release'
}

const resolveState = (sCurrent: string, sLatest: string): UpdateState => {
  if (isVersionAtLeast(sCurrent, sLatest) && isVersionAtLeast(sLatest, sCurrent)) return 'current'
  return isVersionAtLeast(sCurrent, sLatest) ? 'ahead' : 'update-available'
}

export const checkComponentUpdate = async (oOptions: UpdateCheckOptions): Promise<UpdateResult> => {
  const sSlug = repositorySlug(oOptions.repository)
  const oUrl = new URL(releaseEndpoint(oOptions.endpoint), window.location.href)
  oUrl.searchParams.set('repository', sSlug)
  oUrl.searchParams.set('appId', oOptions.id)
  if (oOptions.refresh) oUrl.searchParams.set('refresh', '1')
  try {
    const oResponse = await fetch(oUrl.toString(), {
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    })
    if (!oResponse.ok) throw new Error('HTTP ' + oResponse.status)
    const oPayload = await oResponse.json() as ReleaseResponse
    if (!oPayload.available || !oPayload.version) throw new Error('Latest version is unavailable.')
    const sState = resolveState(oOptions.version, oPayload.version)
    return Object.freeze({
      ...oOptions,
      current: oOptions.version,
      latest: oPayload.version,
      latestVersion: oPayload.version,
      latestUrl: oPayload.url ?? oOptions.repository + '/releases',
      state: sState,
      updateAvailable: sState === 'update-available',
      checkedAt: oPayload.checkedAt ?? null,
      cached: oPayload.cached ?? false,
      stale: oPayload.stale ?? false,
      source: oPayload.source ?? null,
      sourceUrl: oPayload.sourceUrl ?? null,
      fileName: oPayload.fileName ?? null,
    })
  } catch {
    return Object.freeze({
      ...oOptions,
      current: oOptions.version,
      latest: null,
      latestVersion: null,
      latestUrl: oOptions.repository + '/releases',
      state: 'unavailable' as const,
      updateAvailable: false,
      checkedAt: null,
      cached: false,
      stale: false,
      source: null,
      sourceUrl: null,
      fileName: null,
    })
  }
}

const unavailableResult = (oInfo: ComponentInfo): UpdateResult => ({
  ...oInfo,
  current: oInfo.version,
  latest: null,
  latestVersion: null,
  latestUrl: oInfo.releaseNotes ?? oInfo.repository + '/releases',
  state: 'unavailable',
  updateAvailable: false,
  checkedAt: null,
  cached: false,
  stale: false,
  source: null,
  sourceUrl: null,
  fileName: null,
})

const registerApplication = (oApplication: ApplicationRegistration): Readonly<ApplicationRegistration> => {
  if (!/^[a-z][a-z0-9_]{1,63}$/.test(oApplication.id)) throw new Error('Invalid application id: ' + oApplication.id)
  repositorySlug(oApplication.repository)
  oRegisteredApplication = Object.freeze({ ...oApplication })
  return oRegisteredApplication
}

const getRegistration = (): Readonly<ApplicationRegistration> | null => oRegisteredApplication

const resolveRegistration = (oOptions: AboutOptions = {}): Readonly<ApplicationRegistration> => {
  if (oOptions.app && oOptions.requiredCoreVersion) {
    return Object.freeze({ ...oOptions.app, core: '>=' + oOptions.requiredCoreVersion })
  }
  if (oOptions.app) return Object.freeze({ ...oOptions.app })
  if (!oRegisteredApplication) throw new Error('No application is registered in Shared App Core About service.')
  return oRegisteredApplication
}

export const checkRegisteredUpdates = async (sEndpoint?: string): Promise<UpdateSummary> => {
  const oApplication = resolveRegistration()
  const oCoreInfo: ComponentInfo = {
    id: 'hc_shared_app_core',
    name: 'Shared App Core',
    version: CORE_VERSION,
    repository: sDefaultCoreRepository,
    releaseNotes: sDefaultCoreRepository + '/releases',
  }
  const [oAppResult, oCoreResult] = await Promise.all([
    checkComponentUpdate({ ...oApplication, endpoint: sEndpoint }),
    checkComponentUpdate({ ...oCoreInfo, endpoint: sEndpoint }),
  ])
  return Object.freeze({ app: oAppResult, core: oCoreResult })
}

const stateLabel = (sState: UpdateState): string => ({
  current: 'Aktuální',
  'update-available': 'Dostupná aktualizace',
  ahead: 'Novější než zveřejněná',
  unavailable: 'Kontrola není dostupná',
})[sState]

const appendLink = (oParent: HTMLElement, sLabel: string, sUrl: string): void => {
  const oLink = document.createElement('a')
  oLink.href = sUrl
  oLink.target = '_blank'
  oLink.rel = 'noopener noreferrer'
  oLink.textContent = sLabel
  oParent.append(oLink)
}

const renderAbout = (oElement: HTMLElement, sHeading: string, oSummary: UpdateSummary): void => {
  const oHeading = document.createElement('h2')
  oHeading.className = 'hc-shared-app-core-about__heading'
  oHeading.textContent = sHeading
  const oList = document.createElement('div')
  oList.className = 'hc-shared-app-core-about__list'
  for (const oResult of [oSummary.app, oSummary.core]) {
    const oRow = document.createElement('article')
    oRow.className = 'hc-shared-app-core-about__row hc-shared-app-core-about__row--' + oResult.state
    const oName = document.createElement('div')
    const oTitle = document.createElement('strong')
    oTitle.textContent = oResult.name
    const oLinks = document.createElement('span')
    oLinks.className = 'hc-shared-app-core-about__links'
    appendLink(oLinks, 'GitHub', oResult.repository)
    appendLink(oLinks, 'Release Notes', oResult.releaseNotes ?? oResult.repository + '/releases')
    if (oResult.documentation) appendLink(oLinks, 'Dokumentace', oResult.documentation)
    oName.append(oTitle, oLinks)
    const oInstalled = document.createElement('div')
    const oInstalledLabel = document.createElement('small')
    oInstalledLabel.textContent = 'Nainstalováno'
    const oInstalledValue = document.createElement('strong')
    oInstalledValue.textContent = oResult.version
    oInstalled.append(oInstalledLabel, oInstalledValue)
    const oLatest = document.createElement('div')
    const oLatestLabel = document.createElement('small')
    oLatestLabel.textContent = 'Nejnovější'
    oLatest.append(oLatestLabel)
    if (oResult.latestVersion) appendLink(oLatest, oResult.latestVersion, oResult.latestUrl)
    else {
      const oUnknown = document.createElement('span')
      oUnknown.textContent = '—'
      oLatest.append(oUnknown)
    }
    const oState = document.createElement('span')
    oState.className = 'hc-shared-app-core-about__state'
    oState.textContent = stateLabel(oResult.state)
    if (oResult.sourceUrl) oState.title = oResult.sourceUrl + (oResult.fileName ? '\n' + oResult.fileName : '') + (oResult.stale ? '\nCache: stale' : oResult.cached ? '\nCache' : '')
    oRow.append(oName, oInstalled, oLatest, oState)
    oList.append(oRow)
  }
  oElement.replaceChildren(oHeading, oList)
}

export const mountAbout = (oElement: HTMLElement, oOptions: AboutOptions = {}): AboutController => {
  let bDestroyed = false
  const oApplication = resolveRegistration(oOptions)
  const sCoreRepository = oOptions.coreRepository ?? sDefaultCoreRepository
  const oCoreInfo: ComponentInfo = {
    id: 'hc_shared_app_core',
    name: 'Shared App Core',
    version: CORE_VERSION,
    repository: sCoreRepository,
    releaseNotes: sCoreRepository + '/releases',
  }
  const fnSummary = (oAppResult: UpdateResult, oCoreResult: UpdateResult): UpdateSummary => Object.freeze({
    app: oAppResult,
    core: oCoreResult,
  })
  const oInitial = fnSummary(unavailableResult(oApplication), unavailableResult(oCoreInfo))
  const sHeading = oOptions.heading ?? 'O aplikaci'
  oElement.classList.add('hc-shared-app-core-about')
  let sRuntime = 'Mapová cache: zjišťuji stav sdílených počítadel…'
  const fnRender = (oSummary: UpdateSummary): void => {
    renderAbout(oElement, sHeading, oSummary)
    if (oOptions.showMapsRuntime) { const oRuntime = document.createElement('p'); oRuntime.dataset.coreMapsRuntime = 'true'; oRuntime.textContent = sRuntime; oElement.append(oRuntime) }
  }
  fnRender(oInitial)
  if (oOptions.showMapsRuntime) void maps.runtime.get().then(oState => { sRuntime = 'Mapová cache: ' + oState.backend + (oState.available ? ' – dostupná sdílená počítadla' : ' – počítadla nedostupná') }, () => { sRuntime = 'Mapová cache: stav počítadel nelze ověřit' }).then(() => { if (!bDestroyed) { const oRuntime = oElement.querySelector('[data-core-maps-runtime]'); if (oRuntime) oRuntime.textContent = sRuntime } })
  const fnRefresh = async (bRefresh = true): Promise<UpdateSummary> => {
    const oSummary = oOptions.checkUpdates === false
      ? oInitial
      : fnSummary(...await Promise.all([
          checkComponentUpdate({ ...oApplication, endpoint: oOptions.endpoint, refresh: bRefresh }),
          checkComponentUpdate({ ...oCoreInfo, endpoint: oOptions.endpoint, refresh: bRefresh }),
        ]))
    if (!bDestroyed) fnRender(oSummary)
    return oSummary
  }
  void fnRefresh(false)
  return Object.freeze({
    element: oElement,
    refresh: fnRefresh,
    destroy(): void {
      bDestroyed = true
      oElement.replaceChildren()
      oElement.classList.remove('hc-shared-app-core-about')
    },
  })
}

function checkUpdates(): Promise<UpdateSummary>
function checkUpdates(oOptions: UpdateCheckOptions): Promise<UpdateResult>
function checkUpdates(oOptions?: UpdateCheckOptions): Promise<UpdateSummary | UpdateResult> {
  return oOptions ? checkComponentUpdate(oOptions) : checkRegisteredUpdates()
}

export const updates = Object.freeze({ check: checkUpdates, checkComponent: checkComponentUpdate })
export const about = Object.freeze({ register: registerApplication, getRegistration, mount: mountAbout })
