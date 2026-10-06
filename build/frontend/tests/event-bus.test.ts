import { describe, expect, it, vi } from 'vitest'
import { EventBus } from '../event-bus'

interface TestEvents extends Record<string, unknown> {
  ready: { appId: string }
}

describe('EventBus', () => {
  it('subscribes, emits and unsubscribes', () => {
    const bus = new EventBus<TestEvents>()
    const listener = vi.fn()
    const unsubscribe = bus.on('ready', listener)
    bus.emit('ready', { appId: 'weather' })
    unsubscribe()
    bus.emit('ready', { appId: 'wiki' })
    expect(listener).toHaveBeenCalledOnce()
    expect(listener).toHaveBeenCalledWith({ appId: 'weather' })
  })
})
