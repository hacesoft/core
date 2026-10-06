// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest'
import { createSettingsClient } from '../settings'

describe('Settings service', () => {
  it('loads and saves namespaced values', async () => {
    const fnFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ values: { location: 'Praha' } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ values: { location: 'Brno' } }) })
    vi.stubGlobal('fetch', fnFetch)
    const oClient = createSettingsClient('/apps/hc_shared_app_core/api/v1/settings', 'weather')
    await expect(oClient.load()).resolves.toEqual({ location: 'Praha' })
    await expect(oClient.save({ location: 'Brno' })).resolves.toEqual({ location: 'Brno' })
    expect(fnFetch.mock.calls[1]?.[1]?.method).toBe('PUT')
  })
})
