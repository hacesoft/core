import { watchLocation, followLocation } from './map-location'
import { createTileLoader } from './map-tile-loader'
import { dialogs } from './dialogs'

export interface MapPoint { lat: number; lon: number }
export interface MapBounds { north: number; south: number; east: number; west: number }
export interface MapViewport {
  center: MapPoint
  zoom: number
  rangeKm: number
  bounds: MapBounds
  widthPx: number
  heightPx: number
  devicePixelRatio: number
  rotationDeg: number
  headingDeg: number | null
  northUp: boolean
}

export type MapEventName = 'manualPan' | 'locationRequested' | 'destroyed' | 'viewportChanged' | 'moveStart' | 'moveEnd' | 'zoomStart' | 'zoomEnd' | 'resize' | 'rotationChanged' | 'headingChanged' | 'compassAvailable' | 'compassUnavailable' | 'layerError'
export interface MapLayerAdapter {
  id: string
  attach(controller: MapController): void | Promise<void>
  update(viewport: Readonly<MapViewport>): void | Promise<void>
  detach(): void | Promise<void>
  destroy(): void | Promise<void>
}
export interface MapDriver {
  getCenter(): MapPoint
  getZoom(): number
  getBounds(): MapBounds
  setView(center: MapPoint, zoom?: number): void
  zoomIn(): void
  zoomOut(): void
  invalidateSize(): void
  setRotation?(degrees: number): void
  on(event: 'movestart' | 'moveend' | 'zoomstart' | 'zoomend', listener: () => void): void
  off(event: 'movestart' | 'moveend' | 'zoomstart' | 'zoomend', listener: () => void): void
  destroy?(): void
}
export interface CompassOverlayOptions { mode?: 'off' | 'rose' | 'dial' | 'minimal'; opacity?: number; position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'; size?: 'small' | 'medium' | 'large' }
export interface MapMountOptions {
  driver: MapDriver
  center?: MapPoint
  zoom?: number
  home?: MapPoint
  controls?: { zoom?: boolean; home?: boolean; gps?: boolean; compass?: boolean }
  compassOverlay?: boolean | CompassOverlayOptions
}
export interface MapProviderInfo { id: string; name: string; type: 'tile'; cacheable: boolean; requiresApiKey: boolean; configured: boolean; enabled: boolean; mapsets: string[]; tileSizes: number[]; attribution: string }
export interface MapRuntimeStatus { backend: string; available: boolean; externalRequestsAllowed: boolean; tileStorage: string }
export interface MapDiagnostics { rateLimitedRequests?: number | null; limiterUnavailableRequests?: number | null; providerErrors?: number | null; runtimeCache?: MapRuntimeStatus; legacyCacheRetained?: boolean; requests: number | null; cacheHits: number | null; cacheMisses: number | null; externalRequests: number | null; deduplicatedRequests: number | null; fallbackResponses: number | null; savedExternalRequests: number | null; cacheBytes: number; cacheLimitBytes: number; cacheFreeBytes: number; cacheUsagePercent: number; cacheEntryCount: number; cacheOldestStoredAt: string | null; cacheNewestStoredAt: string | null; tileCacheTtlSeconds: number; browserCacheTtlSeconds: number; defaultProvider: string; tileRequestsPerMinute: number; externalRequestsPerMinute: number; lastProviderError: string; providers: MapProviderInfo[]; canManage: boolean }
export interface ProviderKeyOffer { provider: string; sourceApp: string; key: string; activate?: boolean }
export interface MapServiceConfiguration { defaultProvider: string; cacheLimitBytes: number; tileCacheTtlDays: number; browserCacheTtlDays: number; tileRequestsPerMinute: number; externalRequestsPerMinute: number; allowedMapsets?: Record<string, string[]> }
export interface MapCacheClearOptions { mode?: 'expired' | 'provider' | 'all'; provider?: string; confirm?: boolean }
export interface MapCacheClearResult { mode: string; provider: string | null; deletedEntries: number; deletedBytes: number; cache: { bytes: number; limitBytes: number; freeBytes: number; usagePercent: number; entryCount: number; oldestStoredAt: string | null; newestStoredAt: string | null } }
export interface DeviceHeadingState { heading: number; mapRotation: number; source: 'device-orientation'; accuracy: 'approximate'; enabled: boolean }
type MapListener = (payload: unknown) => void

const fClampDegrees = (nDegrees: number): number => ((nDegrees % 360) + 360) % 360
const fRangeKm = (oBounds: MapBounds): number => {
  const nLatKm = Math.abs(oBounds.north - oBounds.south) * 111.32
  const nMiddleLat = (oBounds.north + oBounds.south) / 2 * Math.PI / 180
  const nLonKm = Math.abs(oBounds.east - oBounds.west) * 111.32 * Math.cos(nMiddleLat)
  return Math.round(Math.max(nLatKm, nLonKm) / 2)
}

export const createLeafletAdapter = (oMap: Record<string, any>): MapDriver => ({
  getCenter: () => { const oCenter = oMap.getCenter(); return { lat: oCenter.lat, lon: oCenter.lng } },
  getZoom: () => oMap.getZoom(),
  getBounds: () => { const oBounds = oMap.getBounds(); return { north: oBounds.getNorth(), south: oBounds.getSouth(), east: oBounds.getEast(), west: oBounds.getWest() } },
  setView: (oCenter, nZoom) => oMap.setView([oCenter.lat, oCenter.lon], nZoom ?? oMap.getZoom()),
  zoomIn: () => oMap.zoomIn(),
  zoomOut: () => oMap.zoomOut(),
  invalidateSize: () => oMap.invalidateSize({ animate: false }),
  setRotation: typeof oMap.setBearing === 'function' ? (nDegrees) => oMap.setBearing(nDegrees) : undefined,
  on: (sEvent, fnListener) => oMap.on(sEvent, fnListener),
  off: (sEvent, fnListener) => oMap.off(sEvent, fnListener),
})

class CoreMapController {
  readonly element: HTMLElement
  private readonly oDriver: MapDriver
  private readonly oOptions: MapMountOptions
  private readonly oListeners = new Map<MapEventName, Set<MapListener>>()
  private readonly oLayers = new Map<string, MapLayerAdapter>()
  private readonly oResizeObserver: ResizeObserver
  private readonly aDriverBindings: Array<[MapEventName, 'movestart' | 'moveend' | 'zoomstart' | 'zoomend', () => void]> = []
  private oControls: HTMLElement | null = null
  private oCompassOverlay: HTMLElement | null = null
  private nRotationDeg = 0
  private nHeadingDeg: number | null = null
  private bCompassEnabled = false
  private bDestroyed = false
  private bRefreshing = false
  private fnOrientation: ((oEvent: DeviceOrientationEvent) => void) | null = null

  constructor(oElement: HTMLElement, oOptions: MapMountOptions) {
    this.element = oElement
    this.oDriver = oOptions.driver
    this.oOptions = oOptions
    oElement.classList.add('hc-shared-app-core-map')
    if (oOptions.center) this.oDriver.setView(oOptions.center, oOptions.zoom)
    this.bindDriver('moveStart', 'movestart')
    this.bindDriver('moveEnd', 'moveend')
    this.bindDriver('zoomStart', 'zoomstart')
    this.bindDriver('zoomEnd', 'zoomend')
    this.oResizeObserver = new ResizeObserver(() => this.refresh('resize'))
    this.oResizeObserver.observe(oElement)
    this.mountControls()
    this.mountCompassOverlay()
    queueMicrotask(() => this.refresh('viewportChanged'))
  }

  on(sEvent: MapEventName, fnListener: MapListener): () => void {
    const oSet = this.oListeners.get(sEvent) ?? new Set<MapListener>()
    oSet.add(fnListener); this.oListeners.set(sEvent, oSet)
    return () => { oSet.delete(fnListener) }
  }
  getViewport(): Readonly<MapViewport> {
    const oRect = this.element.getBoundingClientRect()
    const oBounds = this.oDriver.getBounds()
    return Object.freeze({ center: this.oDriver.getCenter(), zoom: this.oDriver.getZoom(), rangeKm: fRangeKm(oBounds), bounds: oBounds, widthPx: Math.round(oRect.width), heightPx: Math.round(oRect.height), devicePixelRatio: window.devicePixelRatio || 1, rotationDeg: this.nRotationDeg, headingDeg: this.nHeadingDeg, northUp: this.nRotationDeg === 0 })
  }
  refresh(sEvent: MapEventName = 'viewportChanged'): Readonly<MapViewport> {
    if (this.bDestroyed || this.bRefreshing) return this.getViewport()
    this.bRefreshing = true
    try {
      if (sEvent === 'resize' || sEvent === 'viewportChanged') this.oDriver.invalidateSize()
      const oViewport = this.getViewport()
      this.emit(sEvent, oViewport); if (sEvent !== 'viewportChanged') this.emit('viewportChanged', oViewport)
      for (const oLayer of this.oLayers.values()) {
        try { void Promise.resolve(oLayer.update(oViewport)).catch(oError => this.emit('layerError', { id: oLayer.id, error: oError })) }
        catch (oError) { this.emit('layerError', { id: oLayer.id, error: oError }) }
      }
      return oViewport
    } finally { this.bRefreshing = false }
  }

  async addLayer(oLayer: MapLayerAdapter): Promise<void> {
    if (this.oLayers.has(oLayer.id)) throw new Error('Map layer id already exists: ' + oLayer.id)
    this.oLayers.set(oLayer.id, oLayer); await oLayer.attach(this as unknown as MapController); await oLayer.update(this.getViewport())
  }
  async removeLayer(sId: string): Promise<void> { const oLayer = this.oLayers.get(sId); if (!oLayer) return; this.oLayers.delete(sId); await oLayer.detach() }
  setRotation(nDegrees: number): void { this.nRotationDeg = fClampDegrees(nDegrees); this.oDriver.setRotation?.(this.nRotationDeg); this.updateCompass(); this.emit('rotationChanged', this.getViewport()); this.refresh() }
  isCompassAvailable(): boolean { return typeof window.DeviceOrientationEvent !== 'undefined' }
  async enableCompass(): Promise<boolean> {
    if (!this.isCompassAvailable()) { this.emit('compassUnavailable', null); return false }
    const oOrientation = window.DeviceOrientationEvent as typeof DeviceOrientationEvent & { requestPermission?: () => Promise<string> }
    if (oOrientation.requestPermission && await oOrientation.requestPermission() !== 'granted') { this.emit('compassUnavailable', null); return false }
    this.fnOrientation = (oEvent) => {
      const oExtended = oEvent as DeviceOrientationEvent & { webkitCompassHeading?: number }
      const nHeading = oExtended.webkitCompassHeading ?? (oEvent.alpha === null ? null : 360 - oEvent.alpha)
      if (nHeading === null || !Number.isFinite(nHeading)) return
      this.nHeadingDeg = fClampDegrees(nHeading); this.bCompassEnabled = true; this.setRotation(this.nHeadingDeg)
      this.emit('headingChanged', Object.freeze({ heading: this.nHeadingDeg, mapRotation: this.nRotationDeg, source: 'device-orientation', accuracy: 'approximate', enabled: true } satisfies DeviceHeadingState))
      this.emit('compassAvailable', true)
    }
    window.addEventListener('deviceorientation', this.fnOrientation)
    return true
  }
  disableCompass(): void { if (this.fnOrientation) window.removeEventListener('deviceorientation', this.fnOrientation); this.fnOrientation = null; this.bCompassEnabled = false; this.nHeadingDeg = null; this.setRotation(0) }
  setCenter(point: MapPoint, zoom?: number): void { if(this.bDestroyed)return; this.oDriver.setView(point, zoom ?? this.oDriver.getZoom()); this.refresh() }
  notifyManualPan(): void { if(!this.bDestroyed)this.emit('manualPan', this.getViewport()) }
  async locate(): Promise<MapPoint> {
    this.emit('locationRequested', null)
    const oPosition = await new Promise<GeolocationPosition>((fnResolve, fnReject) => navigator.geolocation.getCurrentPosition(fnResolve, fnReject, { enableHighAccuracy: true, timeout: 10000 }))
    const oPoint = { lat: oPosition.coords.latitude, lon: oPosition.coords.longitude }; this.oDriver.setView(oPoint); this.refresh(); return oPoint
  }
  async destroy(): Promise<void> { if (this.bDestroyed) return; this.bDestroyed = true; this.emit('destroyed', null); this.disableCompass(); this.oResizeObserver.disconnect(); for (const [, sDriverEvent, fnHandler] of this.aDriverBindings) this.oDriver.off(sDriverEvent, fnHandler); for (const oLayer of this.oLayers.values()) { await oLayer.detach(); await oLayer.destroy() }; this.oLayers.clear(); this.oControls?.remove(); this.oCompassOverlay?.remove(); this.oDriver.destroy?.(); this.element.classList.remove('hc-shared-app-core-map') }
  private bindDriver(sCoreEvent: MapEventName, sDriverEvent: 'movestart' | 'moveend' | 'zoomstart' | 'zoomend'): void { const fnHandler = () => { if (this.bDestroyed || this.bRefreshing) return; if (sDriverEvent.endsWith('end')) this.refresh(sCoreEvent); else this.emit(sCoreEvent, this.getViewport()) }; this.aDriverBindings.push([sCoreEvent, sDriverEvent, fnHandler]); this.oDriver.on(sDriverEvent, fnHandler) }
  private emit(sEvent: MapEventName, oPayload: unknown): void { for (const fnListener of this.oListeners.get(sEvent) ?? []) fnListener(oPayload) }
  private mountControls(): void {
    const oConfig = { zoom: true, home: true, gps: true, compass: true, ...this.oOptions.controls }
    const oControls = document.createElement('div'); oControls.className = 'hc-shared-app-core-map__controls'
    const fnButton = (sLabel: string, sTitle: string, fnClick: () => unknown | Promise<unknown>): void => { const oButton = document.createElement('button'); oButton.type = 'button'; oButton.textContent = sLabel; oButton.title = sTitle; oButton.setAttribute('aria-label', sTitle); oButton.addEventListener('click', () => void fnClick()); oControls.append(oButton) }
    if (oConfig.zoom) { fnButton('+', 'Přiblížit', () => this.oDriver.zoomIn()); fnButton('−', 'Oddálit', () => this.oDriver.zoomOut()) }
    if (oConfig.home && this.oOptions.home) fnButton('⌂', 'Domovská pozice', () => { this.oDriver.setView(this.oOptions.home!); this.refresh() })
    if (oConfig.gps && 'geolocation' in navigator) fnButton('◎', 'Moje poloha', () => this.locate())
    if (oConfig.compass && this.isCompassAvailable()) fnButton('🧭', 'Kompas', () => this.bCompassEnabled ? this.disableCompass() : this.enableCompass())
    this.element.append(oControls); this.oControls = oControls
  }
  private mountCompassOverlay(): void { if (!this.oOptions.compassOverlay) return; const oConfig = typeof this.oOptions.compassOverlay === 'boolean' ? {} : this.oOptions.compassOverlay; if (oConfig.mode === 'off') return; const oOverlay = document.createElement('div'); oOverlay.className = 'hc-shared-app-core-map__compass hc-shared-app-core-map__compass--' + (oConfig.mode ?? 'rose') + ' hc-shared-app-core-map__compass--' + (oConfig.position ?? 'bottom-right') + ' hc-shared-app-core-map__compass--' + (oConfig.size ?? 'medium'); oOverlay.style.opacity = String(Math.min(1, Math.max(0, oConfig.opacity ?? .75))); oOverlay.setAttribute('aria-label', 'Orientace mapy'); this.element.append(oOverlay); this.oCompassOverlay = oOverlay; this.updateCompass() }
  private updateCompass(): void { if (!this.oCompassOverlay) return; const oConfig = this.oOptions.compassOverlay; this.oCompassOverlay.textContent = (oConfig && oConfig !== true && oConfig.mode === 'dial') ? Math.round(this.nRotationDeg) + '°' : 'N'; this.oCompassOverlay.style.transform = 'rotate(' + -this.nRotationDeg + 'deg)' }
}

export interface MapController {
  readonly element: HTMLElement
  on(event: MapEventName, listener: MapListener): () => void
  getViewport(): Readonly<MapViewport>
  refresh(event?: MapEventName): Readonly<MapViewport>
  addLayer(layer: MapLayerAdapter): Promise<void>
  removeLayer(id: string): Promise<void>
  setRotation(degrees: number): void
  isCompassAvailable(): boolean
  enableCompass(): Promise<boolean>
  disableCompass(): void
  setCenter(point: MapPoint, zoom?: number): void
  notifyManualPan(): void
  locate(): Promise<MapPoint>
  destroy(): Promise<void>
}

const fCoreMapsUrl = (sPath: string): string => {
  const oOc = (window as unknown as { OC?: { generateUrl?: (path: string) => string } }).OC
  return oOc?.generateUrl?.('/apps/hc_shared_app_core/api/v1/maps' + sPath) ?? '/index.php/apps/hc_shared_app_core/api/v1/maps' + sPath
}
const fMapsJson = async <T>(sUrl: string, oInit: RequestInit = {}): Promise<T> => {
  const oOc = (window as unknown as { OC?: { requestToken?: string } }).OC
  const oAbort = new AbortController()
  const fnAbort = (): void => oAbort.abort()
  oInit.signal?.addEventListener('abort', fnAbort, { once: true })
  if (oInit.signal?.aborted) oAbort.abort()
  let nTimer: ReturnType<typeof setTimeout>
  const oTimeout = new Promise<never>((_, fnReject) => { nTimer = setTimeout(() => { oAbort.abort(); fnReject(new Error('Core Maps neodpovědělo včas.')) }, 10000) })
  try {
    return await Promise.race([oTimeout, (async () => {
      const oResponse = await fetch(sUrl, { credentials: 'same-origin', cache: 'no-store', ...oInit, signal: oAbort.signal, headers: { Accept: 'application/json', ...(oInit.body ? { 'Content-Type': 'application/json', requesttoken: oOc?.requestToken ?? '' } : {}), ...oInit.headers } })
      const oPayload = await oResponse.json() as T & { error?: string }
      if (!oResponse.ok) throw new Error(oPayload.error ?? 'Core Maps request failed (HTTP ' + oResponse.status + ').')
      return oPayload
    })()])
  } finally { clearTimeout(nTimer!); oInit.signal?.removeEventListener('abort', fnAbort) }

}

const fFormatBytes = (nBytes: number): string => nBytes >= 1073741824
  ? (nBytes / 1073741824).toFixed(2) + ' GiB'
  : (nBytes / 1048576).toFixed(1) + ' MiB'

const fOpenCacheSettings = () => {
  const oContent = document.createElement('div')
  oContent.className = 'hc-shared-app-core-map-cache-settings'
  const oLoading = document.createElement('p')
  oLoading.textContent = 'Načítám společné nastavení a statistiky cache…'
  oContent.append(oLoading)
  const oDialog = dialogs.open({
    title: 'Mapová cache a životnost dat',
    content: oContent,
    size: 'large',
    actions: [{ label: 'Zavřít' }],
  })

  const fRender = async (): Promise<void> => {
    try {
      const oStats = await fMapsJson<MapDiagnostics>(fCoreMapsUrl('/diagnostics'))
      const oForm = document.createElement('form')
      oForm.className = 'hc-shared-app-core-map-cache-settings__form'
      const fField = (sLabel: string, sName: string, sValue: string, sType = 'number', sMin?: string, sMax?: string, sStep?: string): HTMLInputElement => {
        const oLabel = document.createElement('label')
        const oText = document.createElement('span'); oText.textContent = sLabel
        const oInput = document.createElement('input'); oInput.type = sType; oInput.name = sName; oInput.value = sValue
        if (sMin) oInput.min = sMin; if (sMax) oInput.max = sMax; if (sStep) oInput.step = sStep
        oLabel.append(oText, oInput); oForm.append(oLabel); return oInput
      }
      const oLimit = fField('Maximální velikost cache (GiB)', 'limit', (oStats.cacheLimitBytes / 1073741824).toFixed(1), 'number', '0.1', '5', '0.1')
      const oTileTtl = fField('Maximální čerstvost podkladů (dny)', 'tileTtl', String(Math.round(oStats.tileCacheTtlSeconds / 86400)), 'number', '1', '3650', '1')
      const oBrowserTtl = fField('Maximum v prohlížeči (dny)', 'browserTtl', String(Math.round(oStats.browserCacheTtlSeconds / 86400)), 'number', '1', '365', '1')
      const oTileRpm = fField('Požadavky na doplnění cache za minutu', 'tileRpm', String(oStats.tileRequestsPerMinute), 'number', '60', '10000', '10')
      const oExternalRpm = fField('Externí přenosy za minutu', 'externalRpm', String(oStats.externalRequestsPerMinute), 'number', '10', '5000', '10')
      const oProviderLabel = document.createElement('label')
      const oProviderText = document.createElement('span'); oProviderText.textContent = 'Výchozí provider'
      const oProvider = document.createElement('select')
      for (const oItem of oStats.providers.filter((oItem) => oItem.enabled)) {
        const oOption = document.createElement('option'); oOption.value = oItem.id; oOption.textContent = oItem.name; oOption.selected = oItem.id === oStats.defaultProvider; oProvider.append(oOption)
      }
      oProviderLabel.append(oProviderText, oProvider); oForm.prepend(oProviderLabel)

      for (const oControl of [oProvider, oLimit, oTileTtl, oBrowserTtl, oTileRpm, oExternalRpm]) oControl.disabled = !oStats.canManage

      const oSave = document.createElement('button'); oSave.type = 'submit'; oSave.textContent = 'Uložit globální nastavení'
      oSave.hidden = !oStats.canManage
      const oSaveStatus = document.createElement('span'); oSaveStatus.className = 'hc-shared-app-core-map-cache-settings__status'; oSaveStatus.setAttribute('aria-live', 'polite')
      const oSaveRow = document.createElement('div'); oSaveRow.className = 'hc-shared-app-core-map-cache-settings__actions'; oSaveRow.append(oSave, oSaveStatus); oForm.append(oSaveRow)

      const oStatistics = document.createElement('section'); oStatistics.className = 'hc-shared-app-core-map-cache-settings__statistics'
      const oHeading = document.createElement('h3'); oHeading.textContent = 'Statistiky cache'; oStatistics.append(oHeading)
      const aStatistics: Array<[string, string]> = [
        ['Obsazeno', fFormatBytes(oStats.cacheBytes) + ' z ' + fFormatBytes(oStats.cacheLimitBytes) + ' (' + oStats.cacheUsagePercent.toFixed(2) + ' %)'],
        ['Sdílená počítadla', oStats.runtimeCache ? oStats.runtimeCache.backend + (oStats.runtimeCache.available ? ' – dostupná' : ' – nedostupná') : 'Neověřeno'],
        ['Počet dlaždic', String(oStats.cacheEntryCount)],
        ['Odmítnuto limitem', String(oStats.rateLimitedRequests ?? '—')],
        ['Chyby počítadla / poskytovatele', (oStats.limiterUnavailableRequests ?? '—') + ' / ' + (oStats.providerErrors ?? '—')],
        ['Hit / miss dnes', (oStats.cacheHits ?? '—') + ' / ' + (oStats.cacheMisses ?? '—')],
        ['Externí / ušetřené', (oStats.externalRequests ?? '—') + ' / ' + (oStats.savedExternalRequests ?? '—')],
        ['Nejstarší položka', oStats.cacheOldestStoredAt ? new Date(oStats.cacheOldestStoredAt).toLocaleString() : '—'],
        ['Nejnovější položka', oStats.cacheNewestStoredAt ? new Date(oStats.cacheNewestStoredAt).toLocaleString() : '—'],
      ]
      const oList = document.createElement('dl')
      for (const [sName, sValue] of aStatistics) { const oRow = document.createElement('div'); const oTerm = document.createElement('dt'); oTerm.textContent = sName; const oValue = document.createElement('dd'); oValue.textContent = sValue; oRow.append(oTerm, oValue); oList.append(oRow) }
      oStatistics.append(oList)

      const oMaintenance = document.createElement('section'); oMaintenance.className = 'hc-shared-app-core-map-cache-settings__maintenance'
      const oMaintenanceHeading = document.createElement('h3'); oMaintenanceHeading.textContent = 'Údržba cache'
      const oMaintenanceStatus = document.createElement('p'); oMaintenanceStatus.setAttribute('aria-live', 'polite')
      const fClearButton = (sLabel: string, oOptions: MapCacheClearOptions): HTMLButtonElement => {
        const oButton = document.createElement('button'); oButton.type = 'button'; oButton.textContent = sLabel
        oButton.addEventListener('click', async () => {
          let bConfirmed = oOptions.mode !== 'all'
          if (!bConfirmed) bConfirmed = await dialogs.confirm({ title: 'Vymazat celou mapovou cache?', message: 'Všechny aplikace budou muset potřebné dlaždice znovu stáhnout.', confirmLabel: 'Ano, vymazat', cancelLabel: 'Zrušit', danger: true })
          if (!bConfirmed) return
          oButton.disabled = true; oMaintenanceStatus.textContent = 'Probíhá údržba…'
          try { const oResult = await fMapsJson<MapCacheClearResult>(fCoreMapsUrl('/cache/clear'), { method: 'POST', body: JSON.stringify({ ...oOptions, confirm: bConfirmed }) }); oMaintenanceStatus.textContent = 'Odstraněno ' + oResult.deletedEntries + ' položek (' + fFormatBytes(oResult.deletedBytes) + ').'; window.setTimeout(() => void fRender(), 600) }
          catch (oError) { oMaintenanceStatus.textContent = oError instanceof Error ? oError.message : String(oError) }
          finally { oButton.disabled = false }
        }); return oButton
      }
      const oMaintenanceActions = document.createElement('div'); oMaintenanceActions.className = 'hc-shared-app-core-map-cache-settings__actions'
      oMaintenanceActions.append(fClearButton('Odstranit prošlé', { mode: 'expired' }), fClearButton('Vymazat vše', { mode: 'all' }))
      oMaintenanceActions.hidden = !oStats.canManage
      oMaintenance.append(oMaintenanceHeading, oMaintenanceActions, oMaintenanceStatus)

      if (!oStats.canManage) {
        const oReadOnly = document.createElement('p'); oReadOnly.textContent = 'Statistiky jsou dostupné pouze pro čtení. Globální nastavení může změnit správce.'; oForm.prepend(oReadOnly)
      }

      oForm.addEventListener('submit', async (oEvent) => {
        oEvent.preventDefault(); oSave.disabled = true; oSaveStatus.textContent = 'Ukládám…'
        try {
          await fMapsJson<MapDiagnostics>(fCoreMapsUrl('/config'), { method: 'PUT', body: JSON.stringify({ defaultProvider: oProvider.value, cacheLimitBytes: Math.round(Number(oLimit.value) * 1073741824), tileCacheTtlDays: Number(oTileTtl.value), browserCacheTtlDays: Number(oBrowserTtl.value), tileRequestsPerMinute: Number(oTileRpm.value), externalRequestsPerMinute: Number(oExternalRpm.value) }) })
          oSaveStatus.textContent = 'Globální nastavení bylo uloženo.'; window.setTimeout(() => void fRender(), 600)
        } catch (oError) { oSaveStatus.textContent = oError instanceof Error ? oError.message : String(oError) }
        finally { oSave.disabled = false }
      })
      const oPolicy = document.createElement('p'); oPolicy.textContent = 'Čtení dlaždice neprodlužuje její čerstvost. Hlavičky poskytovatele mohou nastavit kratší dobu. Limity chrání poskytovatele; ověřené výchozí hodnoty jsou 10 000 požadavků na cache a 5 000 externích přenosů za minutu.'
      oContent.replaceChildren(oPolicy, oForm, oStatistics, oMaintenance)
    } catch (oError) {
      const oFailure = document.createElement('p'); oFailure.className = 'hc-shared-app-core-map-cache-settings__error'; oFailure.textContent = oError instanceof Error ? oError.message : 'Nastavení cache nelze načíst.'; oContent.replaceChildren(oFailure)
    }
  }
  void fRender()
  return oDialog
}

export const maps = Object.freeze({
  createTileLoader,
  watchLocation,
  followLocation,
  mount: (oElement: HTMLElement, oOptions: MapMountOptions): MapController => new CoreMapController(oElement, oOptions),
  adapters: Object.freeze({ leaflet: createLeafletAdapter }),
  tileUrl: (sProvider: string, sMapset: string, nTileSize: number, nZoom: number | string, nX: number | string, nY: number | string): string => fCoreMapsUrl('/tile/' + [sProvider, sMapset, nTileSize, nZoom, nX, nY].map(String).map(encodeURIComponent).join('/')),
  // Keep Leaflet placeholders outside OC.generateUrl(). Real Nextcloud URL
  // generators may percent-encode braces, which would make the template
  // unusable even though simple test stubs leave it unchanged.
  tileTemplate: (sProvider: string, sMapset = 'basic', nTileSize = 256): string => fCoreMapsUrl('/tile/' + [sProvider, sMapset, nTileSize].map(String).map(encodeURIComponent).join('/')) + '/{z}/{x}/{y}',
  providers: Object.freeze({
    list: async (): Promise<MapProviderInfo[]> => (await fMapsJson<{ providers: MapProviderInfo[] }>(fCoreMapsUrl('/providers'))).providers,
    offerKey: async (oOffer: ProviderKeyOffer): Promise<Record<string, unknown>> => fMapsJson(fCoreMapsUrl('/provider-key'), { method: 'POST', body: JSON.stringify({ ...oOffer, activate: oOffer.activate ?? true }) }),
    setEnabled: async (sProvider: string, bEnabled: boolean): Promise<{ provider: string; enabled: boolean }> => fMapsJson(fCoreMapsUrl('/provider/' + encodeURIComponent(sProvider) + '/enabled'), { method: 'PUT', body: JSON.stringify({ enabled: bEnabled }) }),
    configure: async (oConfiguration: MapServiceConfiguration): Promise<MapDiagnostics> => fMapsJson<MapDiagnostics>(fCoreMapsUrl('/config'), { method: 'PUT', body: JSON.stringify(oConfiguration) }),
  }),
  runtime: Object.freeze({ get: async (): Promise<MapRuntimeStatus> => fMapsJson<MapRuntimeStatus>(fCoreMapsUrl('/runtime')) }),
  diagnostics: Object.freeze({ get: async (): Promise<MapDiagnostics> => fMapsJson<MapDiagnostics>(fCoreMapsUrl('/diagnostics')) }),
  cache: Object.freeze({
    clear: async (oOptions: MapCacheClearOptions = {}): Promise<MapCacheClearResult> => fMapsJson<MapCacheClearResult>(fCoreMapsUrl('/cache/clear'), { method: 'POST', body: JSON.stringify({ mode: oOptions.mode ?? 'expired', provider: oOptions.provider ?? null, confirm: oOptions.confirm ?? false }) }),
    openSettings: fOpenCacheSettings,
  }),
})
