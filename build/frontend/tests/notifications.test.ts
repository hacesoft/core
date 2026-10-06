// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
  callback(0)
  return 1
})

describe('NotificationManager', () => {
  beforeEach(async () => {
    const { notifications } = await import('../notifications')
    notifications.clear()
    document.body.innerHTML = ''
  })

  it('renders safe content and can be dismissed', async () => {
    const { notifications } = await import('../notifications')
    const notification = notifications.success('<b>Saved</b>', { persistent: true })
    expect(notification.element.textContent).toContain('<b>Saved</b>')
    expect(notification.element.querySelector('b')).toBeNull()
    notification.dismiss()
    await expect(notification.closed).resolves.toBe('dismiss')
  })

  it('deduplicates active notifications', async () => {
    const { notifications } = await import('../notifications')
    const first = notifications.info('Saved', { persistent: true, dedupeKey: 'save' })
    const second = notifications.info('Saved', { persistent: true, dedupeKey: 'save' })
    expect(second).toBe(first)
    expect(first.element.textContent).toContain('2× zopakováno')
  })
})

