// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { background } from '../background'

afterEach(() => { vi.unstubAllGlobals(); document.body.replaceChildren() })

it('stores an app-scoped background, rejects unsafe image URLs and restores styles', async () => {
  const state: Record<string, string> = {}
  const fetcher = vi.fn(async (_url: string, init: RequestInit) => {
    if (init.method === 'PUT') Object.assign(state, (JSON.parse(String(init.body)) as { values: Record<string, string> }).values)
    return { ok: true, json: async () => ({ values: state }) }
  })
  vi.stubGlobal('fetch', fetcher)
  const host = document.createElement('div'); host.style.backgroundColor = 'red'; document.body.append(host)
  const controller = background.create(host, '/settings', 'my_application')
  await expect(controller.save({ mode: 'image', url: 'javascript:alert(1)' })).rejects.toThrow('HTTPS')
  await controller.save({ mode: 'solid', color: '#112233' })
  expect(host.style.backgroundColor).toBe('rgb(17, 34, 51)')
  expect(fetcher.mock.calls[0]![0]).toContain('namespace=my_application')
  expect((await controller.load()).mode).toBe('solid')
  controller.destroy()
  expect(host.style.backgroundColor).toBe('red')
})
