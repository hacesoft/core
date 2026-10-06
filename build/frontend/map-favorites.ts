import type { MapPoint } from './maps'

export interface MapFavorite extends MapPoint {
  id: string
  name: string
  type: string
  icon: string
  color: string
  note: string
  sourceApp: string
  createdAt: string
  updatedAt: string
}
export interface NewMapFavorite extends MapPoint { name: string; type?: string; icon?: string; color?: string; note?: string; sourceApp: string }
export type MapFavoriteChanges = Partial<Pick<MapFavorite, 'name' | 'lat' | 'lon' | 'type' | 'icon' | 'color' | 'note'>>

const fEndpoint = (sPath = ''): string => {
  const oWindow = window as Window & { OC?: { generateUrl?: (sPath: string) => string } }
  const sBase = oWindow.OC?.generateUrl?.('/apps/hc_shared_app_core/api/v1/map-favorites') ?? '/apps/hc_shared_app_core/api/v1/map-favorites'
  return sBase + sPath
}
const fHeaders = (bJson = false): Record<string, string> => {
  const oWindow = window as Window & { OC?: { requestToken?: string } }
  const oHeaders: Record<string, string> = { Accept: 'application/json' }
  if (bJson) oHeaders['Content-Type'] = 'application/json'
  if (oWindow.OC?.requestToken) oHeaders.requesttoken = oWindow.OC.requestToken
  return oHeaders
}
const fRequest = async (sUrl: string, oInit: RequestInit = {}): Promise<any> => {
  const oResponse = await fetch(sUrl, { credentials: 'same-origin', cache: 'no-store', ...oInit })
  const oPayload = await oResponse.json()
  if (!oResponse.ok) throw new Error(oPayload.error ?? 'Map favorites request failed.')
  return oPayload
}

export const mapFavorites = Object.freeze({
  async list(): Promise<ReadonlyArray<Readonly<MapFavorite>>> { const oPayload = await fRequest(fEndpoint(), { headers: fHeaders() }); return Object.freeze(oPayload.items.map((oItem: MapFavorite) => Object.freeze(oItem))) },
  async add(oFavorite: NewMapFavorite): Promise<Readonly<MapFavorite>> { const oPayload = await fRequest(fEndpoint(), { method: 'POST', headers: fHeaders(true), body: JSON.stringify({ favorite: oFavorite }) }); return Object.freeze(oPayload.item) },
  async update(sId: string, oChanges: MapFavoriteChanges): Promise<Readonly<MapFavorite>> { const oPayload = await fRequest(fEndpoint('/' + encodeURIComponent(sId)), { method: 'PUT', headers: fHeaders(true), body: JSON.stringify({ changes: oChanges }) }); return Object.freeze(oPayload.item) },
  async remove(sId: string): Promise<void> { await fRequest(fEndpoint('/' + encodeURIComponent(sId)), { method: 'DELETE', headers: fHeaders() }) },
})
