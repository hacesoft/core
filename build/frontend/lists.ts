export interface SharedList {
  id: string; namespace: string; owner: string; title: string; icon: string; archived: boolean; position: number; parent_id: string | null
  permission: 'read' | 'edit' | 'owner'; created_at: string; updated_at: string
}
export interface Place {
  id: string; name: string; lat: number; lon: number; note: string; color: string; position: number
  favorite?: boolean; icon?: string; type?: string; sourceApp?: string
  list_id?: string; permission?: 'read' | 'edit' | 'owner'
}
export interface SharedPlace extends Place {
  list_id: string; permission: 'read' | 'edit'
}
export interface ListShare {
  list_id: string; target_type: 'user' | 'group'; target_id: string; permission: 'read' | 'edit'
}
export interface PlaceShare extends Omit<ListShare, 'list_id'> { place_id: string }
const endpoint = (namespace: string, path = ''): string => {
  if (!/^[a-z][a-z0-9_]{1,63}$/.test(namespace)) throw new Error('Invalid namespace')
  const origin = `/apps/hc_shared_app_core/api/v1/lists/${namespace}`
  const win = window as Window & { OC?: { generateUrl?: (path: string) => string } }
  return (win.OC?.generateUrl?.(origin) ?? origin) + path
}
const request = async <T>(url: string, method = 'GET', body?: object): Promise<T> => {
  const win = window as Window & { OC?: { requestToken?: string } }
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body) headers['Content-Type'] = 'application/json'
  if (win.OC?.requestToken) headers.requesttoken = win.OC.requestToken
  const response = await fetch(url, { method, headers, credentials: 'same-origin', cache: 'no-store', body: body ? JSON.stringify(body) : undefined })
  const data = await response.json() as T & { error?: string }
  if (!response.ok) throw new Error(data.error ?? `Lists request failed: HTTP ${response.status}`)
  return data
}
const part = (value: string): string => encodeURIComponent(value)
export const lists = Object.freeze({
  list: async (ns: string): Promise<SharedList[]> => (await request<{ items: SharedList[] }>(endpoint(ns))).items,
  create: async (ns: string, title: string, position = 0, parentId: string | null = null, icon = '📁'): Promise<SharedList> => (await request<{ item: SharedList }>(endpoint(ns), 'POST', { list: { title, position, parent_id: parentId, icon } })).item,
  update: async (ns: string, id: string, changes: Partial<Pick<SharedList, 'title' | 'icon' | 'position' | 'archived' | 'parent_id'>>): Promise<SharedList> => (await request<{ item: SharedList }>(endpoint(ns, '/' + part(id)), 'PUT', { changes })).item,
  places: async (ns: string, id: string): Promise<Place[]> => (await request<{ items: Place[] }>(endpoint(ns, `/${part(id)}/places`))).items,
  sharedPlaces: async (ns: string): Promise<SharedPlace[]> => (await request<{ items: SharedPlace[] }>(endpoint(ns, '/shared-places'))).items,
  addPlace: async (ns: string, id: string, place: Omit<Place, 'id'>): Promise<Place> => (await request<{ item: Place }>(endpoint(ns, `/${part(id)}/places`), 'POST', { place })).item,
  updatePlace: async (ns: string, id: string, placeId: string, changes: Partial<Omit<Place, 'id'>>): Promise<Place> => (await request<{ item: Place }>(endpoint(ns, `/${part(id)}/places/${part(placeId)}`), 'PUT', { changes })).item,
  movePlace: async (ns: string, id: string, placeId: string, targetListId: string): Promise<Place> => (await request<{ item: Place }>(endpoint(ns, `/${part(id)}/places/${part(placeId)}/move`), 'POST', { targetListId })).item,
  removePlace: async (ns: string, id: string, placeId: string): Promise<void> => { await request(endpoint(ns, `/${part(id)}/places/${part(placeId)}`), 'DELETE') },
  placeShares: async (ns: string, id: string, placeId: string): Promise<PlaceShare[]> => (await request<{ items: PlaceShare[] }>(endpoint(ns, `/${part(id)}/places/${part(placeId)}/shares`))).items,
  sharePlace: async (ns: string, id: string, placeId: string, type: 'user' | 'group', target: string, permission: 'read' | 'edit'): Promise<PlaceShare> => (await request<{ item: PlaceShare }>(endpoint(ns, `/${part(id)}/places/${part(placeId)}/shares`), 'PUT', { share: { type, id: target, permission } })).item,
  unsharePlace: async (ns: string, id: string, placeId: string, type: 'user' | 'group', target: string): Promise<void> => { await request(endpoint(ns, `/${part(id)}/places/${part(placeId)}/shares/${part(type)}/${part(target)}`), 'DELETE') },
  shares: async (ns: string, id: string): Promise<ListShare[]> => (await request<{ items: ListShare[] }>(endpoint(ns, `/${part(id)}/shares`))).items,
  share: async (ns: string, id: string, type: 'user' | 'group', target: string, permission: 'read' | 'edit'): Promise<ListShare> => (await request<{ item: ListShare }>(endpoint(ns, `/${part(id)}/shares`), 'PUT', { share: { type, id: target, permission } })).item,
  unshare: async (ns: string, id: string, type: 'user' | 'group', target: string): Promise<void> => { await request(endpoint(ns, `/${part(id)}/shares/${part(type)}/${part(target)}`), 'DELETE') },
})
