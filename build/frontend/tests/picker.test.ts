// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest'
import { createPicker } from '../picker'

describe('User/Group Picker', () => {
  it('selects and removes a search result', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items: [{ id: 'pavel', label: 'Pavel', type: 'user' }] }) }))
    const oElement = document.createElement('div')
    const oController = createPicker(oElement, { endpoint: '/search' })
    const oInput = oElement.querySelector<HTMLInputElement>('input')!
    oInput.dispatchEvent(new Event('focus'))
    await vi.waitFor(() => expect(oElement.querySelector('[role="option"]')).not.toBeNull())
    ;(oElement.querySelector('[role="option"]') as HTMLButtonElement).click()
    expect(oController.selected()).toEqual([{ id: 'pavel', label: 'Pavel', type: 'user' }])
    ;(oElement.querySelector('.hc-shared-app-core-picker__chip button') as HTMLButtonElement).click()
    expect(oController.selected()).toEqual([])
  })
})
