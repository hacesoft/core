// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { about, checkComponentUpdate, updates } from '../about'

describe('About and Update Service', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ available: true, version: '1.2.0', url: 'https://github.com/hacesoft/nextcloud-weather/releases/tag/v1.2.0', checkedAt: 123, cached: true }),
    }))
  })

  it('detects an available update and exposes concise aliases', async () => {
    const oResult = await checkComponentUpdate({ id: 'weather', name: 'Weather', version: '1.1.0', repository: 'https://github.com/hacesoft/nextcloud-weather' })
    expect(oResult.state).toBe('update-available')
    expect(oResult.current).toBe('1.1.0')
    expect(oResult.latest).toBe('1.2.0')
  })

  it('registers once and returns application plus Core update data', async () => {
    about.register({ id: 'weather', name: 'Weather', version: '1.1.0', repository: 'https://github.com/hacesoft/nextcloud-weather', releaseNotes: 'https://github.com/hacesoft/nextcloud-weather/releases' })
    const oSummary = await updates.check()
    expect(oSummary.app.current).toBe('1.1.0')
    expect(oSummary.core.name).toBe('Shared App Core')
  })

  it('renders repositories and release notes without a remote check', async () => {
    const oElement = document.createElement('div')
    const oController = about.mount(oElement, { checkUpdates: false })
    expect(oElement.textContent).toContain('Weather')
    expect(oElement.textContent).toContain('Shared App Core')
    expect(oElement.textContent).toContain('Release Notes')
    expect(oElement.querySelectorAll('a')).toHaveLength(4)
    const oSummary = await oController.refresh()
    expect(oSummary.app.state).toBe('unavailable')
    oController.destroy()
  })

  it('rejects repositories outside the configured GitHub owner', async () => {
    await expect(checkComponentUpdate({ id: 'foreign', name: 'Foreign', version: '1.0.0', repository: 'https://github.com/example/project' })).rejects.toThrow('Unsupported GitHub repository')
  })
})
