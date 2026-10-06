// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { maps, type MapDriver } from '../maps'

const fDriver = (): MapDriver => ({
  getCenter: () => ({ lat: 49.1, lon: 16.6 }), getZoom: () => 8,
  getBounds: () => ({ north: 50, south: 48, east: 18, west: 15 }),
  setView: vi.fn(), zoomIn: vi.fn(), zoomOut: vi.fn(), invalidateSize: vi.fn(),
  on: vi.fn(), off: vi.fn(),
})

describe('Core Maps', () => {
  beforeEach(() => {
    document.body.replaceChildren()
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
    vi.stubGlobal('OC', { generateUrl: (sPath: string) => '/nextcloud/index.php' + sPath, requestToken: 'token' })
  })

  it('publishes a complete viewport and manages application layers', async () => {
    const oElement = document.createElement('div')
    Object.defineProperty(oElement, 'getBoundingClientRect', { value: () => ({ width: 800, height: 500 }) })
    const oController = maps.mount(oElement, { driver: fDriver(), controls: { gps: false, compass: false } })
    const fnUpdate = vi.fn()
    await oController.addLayer({ id: 'weather-radar', attach: vi.fn(), update: fnUpdate, detach: vi.fn(), destroy: vi.fn() })
    expect(oController.getViewport()).toMatchObject({ center: { lat: 49.1, lon: 16.6 }, zoom: 8, widthPx: 800, heightPx: 500, rotationDeg: 0 })
    expect(fnUpdate).toHaveBeenCalled()
    await oController.destroy()
  })

  it('normalizes rotation and updates the compass overlay', async () => {
    const oElement = document.createElement('div')
    const oController = maps.mount(oElement, { driver: fDriver(), compassOverlay: { mode: 'dial', opacity: .5 }, controls: { gps: false, compass: false } })
    oController.setRotation(370)
    expect(oController.getViewport().rotationDeg).toBe(10)
    expect(oElement.querySelector('.hc-shared-app-core-map__compass')?.textContent).toBe('10°')
    await oController.destroy()
  })

  it('does not recurse when driver resize emits moveend', async () => {
    const oDriver = fDriver()
    const oEvents = new Map<string, () => void>()
    oDriver.on = (sEvent, fn) => { oEvents.set(sEvent, fn) }
    const fnInvalidate = vi.fn(() => oEvents.get('moveend')?.())
    oDriver.invalidateSize = fnInvalidate
    const oController = maps.mount(document.createElement('div'), { driver: oDriver, controls: { gps: false, compass: false } })
    await Promise.resolve()
    fnInvalidate.mockClear()
    oController.refresh()
    expect(fnInvalidate).toHaveBeenCalledTimes(1)
    const fnMove = vi.fn(); oController.on('moveEnd', fnMove)
    oEvents.get('moveend')?.()
    expect(fnMove).toHaveBeenCalledTimes(1)
    expect(fnInvalidate).toHaveBeenCalledTimes(1)
    await oController.destroy()
  })

  it('connects follow to the real controller and detaches on destruction', async () => {
    const driver = fDriver()
    const controller = maps.mount(document.createElement('div'), { driver, controls: { gps:false, compass:false } })
    const tracker = { getLast: () => ({point:{lat:50,lon:16}, timestamp:1, accuracyM:null, altitudeM:null, altitudeAccuracyM:null, headingDeg:null, speedMps:null}), subscribe: vi.fn(() => vi.fn()), stop:vi.fn(), destroy:vi.fn() }
    const follow = maps.followLocation(controller, tracker)
    expect(driver.setView).toHaveBeenCalledWith({lat:50,lon:16},8)
    controller.setCenter({lat:51,lon:17})
    expect(follow.isEnabled()).toBe(true)
    controller.notifyManualPan()
    expect(follow.isEnabled()).toBe(false)
    follow.enable()
    await controller.destroy()
    expect(follow.isEnabled()).toBe(false)
    expect(tracker.destroy).not.toHaveBeenCalled()
  })

  it('builds shared proxy tile URLs without exposing provider keys', () => {
    expect(maps.tileTemplate('mapy')).toBe('/nextcloud/index.php/apps/hc_shared_app_core/api/v1/maps/tile/mapy/basic/256/{z}/{x}/{y}')
    expect(maps.tileUrl('osm', 'basic', 256, 8, 140, 88)).toContain('/maps/tile/osm/basic/256/8/140/88')
    expect(maps.tileTemplate('mapy')).not.toContain('apikey')
    expect(typeof maps.cache.clear).toBe('function')
  })

  it('keeps tile placeholders intact when Nextcloud encodes generated paths', () => {
    vi.stubGlobal('OC', {
      generateUrl: (sPath: string) => '/nextcloud/index.php' + encodeURI(sPath).replaceAll('{', '%7B').replaceAll('}', '%7D'),
      requestToken: 'token',
    })
    expect(maps.tileTemplate('osm', 'basic', 256)).toBe('/nextcloud/index.php/apps/hc_shared_app_core/api/v1/maps/tile/osm/basic/256/{z}/{x}/{y}')
  })

  it('opens the shared responsive cache settings dialog', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        requests: 12, cacheHits: 9, cacheMisses: 3, externalRequests: 3,
        deduplicatedRequests: 0, fallbackResponses: 0, savedExternalRequests: 9,
        cacheBytes: 1048576, cacheLimitBytes: 536870912, cacheFreeBytes: 535822336,
        cacheUsagePercent: .2, cacheEntryCount: 4, cacheOldestStoredAt: null,
        cacheNewestStoredAt: null, tileCacheTtlSeconds: 31536000,
        browserCacheTtlSeconds: 604800, defaultProvider: 'osm',
        tileRequestsPerMinute: 600, externalRequestsPerMinute: 120,
        lastProviderError: '', providers: [{ id: 'osm', name: 'OpenStreetMap', enabled: true }], canManage: true,
      }),
    }))
    const oDialog = maps.cache.openSettings()
    await vi.waitFor(() => expect(document.body.textContent).toContain('Statistiky cache'))
    expect(document.body.textContent).toContain('Uložit globální nastavení')
    expect(document.querySelector('.hc-shared-app-core-map-cache-settings')).not.toBeNull()
    oDialog.close()
  })
})
