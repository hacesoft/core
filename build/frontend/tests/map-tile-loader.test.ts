// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { createTileLoader } from '../map-tile-loader'
const url = '/apps/hc_shared_app_core/api/v1/maps/tile/mapy/basic/256/8/140/88'
const ok = () => ({ ok: true, status: 200, blob: async () => new Blob(['tile'], { type: 'image/png' }) })
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })
it('waits for Retry-After then recovers without page reload', async () => {
  vi.useFakeTimers()
  const fetcher = vi.fn().mockResolvedValueOnce({ status: 429, headers: new Headers({ 'Retry-After': '37' }) }).mockResolvedValue(ok())
  vi.stubGlobal('fetch', fetcher)
  const loader = createTileLoader(), result = loader.load(url)
  await vi.advanceTimersByTimeAsync(36000); expect(fetcher).toHaveBeenCalledTimes(1)
  await vi.advanceTimersByTimeAsync(1200); expect((await result).type).toBe('image/png'); expect(fetcher).toHaveBeenCalledTimes(2)
  loader.destroy()
})
it('caps concurrent requests and cancels obsolete queued tiles', async () => {
  const fetcher = vi.fn((_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(new DOMException('', 'AbortError')))))
  vi.stubGlobal('fetch', fetcher)
  const loader = createTileLoader(), controller = new AbortController()
  const results = Array.from({length: 12}, () => loader.load(url, {signal: controller.signal}).catch(e => e.name))
  expect(fetcher).toHaveBeenCalledTimes(4)
  controller.abort(); loader.destroy()
  expect(await Promise.all(results)).toEqual(Array(12).fill('AbortError'))
  expect(fetcher).toHaveBeenCalledTimes(4)
})
it('has a finite retry budget for unavailable service', async () => {
  vi.useFakeTimers()
  const fetcher = vi.fn().mockResolvedValue({ status: 503, headers: new Headers({'Retry-After':'1'}) })
  vi.stubGlobal('fetch', fetcher)
  const loader = createTileLoader(), result = loader.load(url).catch(e => e.message)
  await vi.runAllTimersAsync()
  expect(await result).toContain('after retries'); expect(fetcher).toHaveBeenCalledTimes(4); loader.destroy()
})
it('rejects foreign URLs and terminal errors without retrying', async () => {
  const fetcher = vi.fn().mockResolvedValue({ status: 400, ok: false })
  vi.stubGlobal('fetch', fetcher)
  const loader = createTileLoader()
  await expect(loader.load('https://example.com/tile')).rejects.toThrow('Core tile URL')
  await expect(loader.load(url)).rejects.toThrow('400')
  expect(fetcher).toHaveBeenCalledTimes(1); loader.destroy()
})
