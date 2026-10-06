// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
  callback(0)
  return 1
})
vi.stubGlobal('crypto', { randomUUID: () => 'test-id' })

describe('DialogService', () => {
  beforeEach(async () => {
    document.body.innerHTML = ''
    const { dialogs } = await import('../dialogs')
    dialogs.closeAll()
  })

  it('opens and closes a dialog with Escape', async () => {
    const { dialogs } = await import('../dialogs')
    const dialog = dialogs.open({ title: 'Test', content: 'Content' })
    expect(document.querySelector('[role="dialog"]')).not.toBeNull()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await expect(dialog.closed).resolves.toBe('escape')
    expect(document.querySelector('[role="dialog"]')).toBeNull()
  })

  it('returns a safe confirmation result', async () => {
    const { dialogs } = await import('../dialogs')
    const result = dialogs.confirm({ title: 'Delete', message: 'Really?' })
    const buttons = document.querySelectorAll<HTMLButtonElement>('.hc-shared-app-core-dialog__action')
    buttons[1]!.click()
    await expect(result).resolves.toBe(true)
  })
})

