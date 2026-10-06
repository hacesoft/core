// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { lists } from '../lists'

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

it('uses CSRF token and only returns server-authorized list results', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ items: [{ id: 'list_1', permission: 'read' }] }) })
    .mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({ error: 'Access denied.' }) })
  vi.stubGlobal('fetch', fetcher)
  ;(window as Window & { OC?: { generateUrl: (p: string) => string; requestToken: string } }).OC = { generateUrl: path => '/nc' + path, requestToken: 'test-token' }
  expect(await lists.list('map_places')).toEqual([{ id: 'list_1', permission: 'read' }])
  await expect(lists.addPlace('map_places', 'list_1', { name: 'Prague', lat: 50, lon: 14, note: '', color: '#3388ff', position: 0 })).rejects.toThrow('Access denied.')
  expect(fetcher.mock.calls[1]![1]).toMatchObject({ method: 'POST', credentials: 'same-origin', headers: { requesttoken: 'test-token' } })
  expect(fetcher.mock.calls[1]![0]).toContain('/nc/apps/hc_shared_app_core/api/v1/lists/map_places/list_1/places')
})

it('sends hierarchy, individual place sharing and moves through the public API', async () => {
  const fetcher = vi.fn().mockImplementation(async () => ({ ok: true, json: async () => ({ item: { id: 'list_child' }, items: [] }) }))
  vi.stubGlobal('fetch', fetcher)
  const parent = 'list_parent', child = 'list_child', place = 'place_shared'
  await lists.create('hc_navigation', 'Prague', 0, parent, '📍')
  await lists.update('hc_navigation', child, { archived: true, parent_id: null })
  await lists.sharePlace('hc_navigation', child, place, 'user', 'bob', 'read')
  await lists.movePlace('hc_navigation', child, place, parent)
  await lists.sharedPlaces('hc_navigation')
  expect(JSON.parse(fetcher.mock.calls[0]![1]!.body)).toEqual({ list: { title: 'Prague', position: 0, parent_id: parent, icon: '📍' } })
  expect(JSON.parse(fetcher.mock.calls[1]![1]!.body)).toEqual({ changes: { archived: true, parent_id: null } })
  expect(fetcher.mock.calls[2]![0]).toContain('/list_child/places/place_shared/shares')
  expect(JSON.parse(fetcher.mock.calls[2]![1]!.body)).toEqual({ share: { type: 'user', id: 'bob', permission: 'read' } })
  expect(JSON.parse(fetcher.mock.calls[3]![1]!.body)).toEqual({ targetListId: parent })
  expect(fetcher.mock.calls[4]![0]).toContain('/shared-places')
})
