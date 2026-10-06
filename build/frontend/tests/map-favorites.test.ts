// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mapFavorites } from '../map-favorites'

describe('Map Favorites', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items: [{ id: 'place_1', name: 'Domov', lat: 49, lon: 16 }] }) })))
  it('loads shared favorite places from Core backend', async () => { const aItems = await mapFavorites.list(); expect(aItems[0]?.name).toBe('Domov') })
})
