/** Bounded tile transport shared by applications; rendering stays with the map driver. */
export interface TileLoadOptions { signal?: AbortSignal; onWait?: (seconds: number) => void }
interface Job { url: string; options: TileLoadOptions; resolve: (blob: Blob) => void; reject: (error: unknown) => void; controller: AbortController; done: () => void }
const abortError = () => new DOMException('Tile request cancelled', 'AbortError')
function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(abortError()); return }
    const cancel = () => { clearTimeout(timer); reject(abortError()) }
    const timer = setTimeout(() => { signal.removeEventListener('abort', cancel); resolve() }, ms)
    signal.addEventListener('abort', cancel, { once: true })
  })
}
export function createTileLoader() {
  let destroyed = false, active = 0, pausedUntil = 0
  const queue: Job[] = [], controllers = new Set<AbortController>()
  async function run(job: Job): Promise<Blob> {
    for (let attempt = 0; attempt < 4; attempt++) {
      while (pausedUntil > Date.now()) {
        job.options.onWait?.(Math.ceil((pausedUntil - Date.now()) / 1000))
        await delay(pausedUntil - Date.now() + 100, job.controller.signal)
      }
      if (job.controller.signal.aborted) throw abortError()
      const request = new AbortController()
      const cancel = () => request.abort()
      job.controller.signal.addEventListener('abort', cancel, { once: true })
      const timer = setTimeout(cancel, 20000)
      try {
        const response = await fetch(job.url, { credentials: 'same-origin', signal: request.signal })
        if (response.status === 429 || response.status === 503) {
          const raw = response.headers.get('Retry-After') || '5'
          const seconds = /^\d+$/.test(raw) ? Number(raw) : Math.max(1, Math.ceil((Date.parse(raw) - Date.now()) / 1000))
          if (!Number.isFinite(seconds) || seconds > 120) throw new Error('Map service requires a longer pause. Try again later.')
          pausedUntil = Math.max(pausedUntil, Date.now() + Math.max(1, seconds) * 1000)
          await response.body?.cancel()
          if (attempt === 3) throw new Error('Map service remains unavailable after retries.')
          continue
        }
        if (!response.ok) throw new Error('Map tile HTTP ' + response.status)
        const blob = await response.blob()
        if (!/^image\/(png|jpeg|webp)(;|$)/i.test(blob.type) || blob.size > 4194304) throw new Error('Invalid map tile image')
        return blob
      } catch (error) {
        if (job.controller.signal.aborted) throw abortError()
        // Network/time-out failures get bounded backoff; terminal HTTP/image errors do not.
        if (attempt === 3 || !(error instanceof TypeError || (error instanceof DOMException && error.name === 'AbortError'))) throw error
        pausedUntil = Math.max(pausedUntil, Date.now() + (attempt + 1) * 2000)
      } finally {
        clearTimeout(timer); job.controller.signal.removeEventListener('abort', cancel)
      }
    }
    throw new Error('Tile retry budget exhausted')
  }
  function pump(): void {
    while (!destroyed && active < 4 && queue.length) {
      const job = queue.shift()!
      if (job.controller.signal.aborted) { job.done(); job.reject(abortError()); continue }
      active++
      void run(job).then(job.resolve, job.reject).finally(() => { active--; job.done(); pump() })
    }
  }
  return {
    load(url: string, options: TileLoadOptions = {}): Promise<Blob> {
      if (destroyed || options.signal?.aborted) return Promise.reject(abortError())
      const target = new URL(url, window.location.href)
      if (target.origin !== window.location.origin || !target.pathname.includes('/apps/hc_shared_app_core/api/v1/maps/tile/')) return Promise.reject(new Error('Use a Core tile URL'))
      return new Promise((resolve, reject) => {
        const controller = new AbortController(); controllers.add(controller)
        const lifetime = setTimeout(() => { controller.abort(); reject(new Error('Map tile loading timed out. Try again.')) }, 240000)
        const cancel = () => { controller.abort(); reject(abortError()) }
        options.signal?.addEventListener('abort', cancel, { once: true })
        const done = () => { clearTimeout(lifetime); controllers.delete(controller); options.signal?.removeEventListener('abort', cancel) }
        queue.push({ url: target.href, options, resolve, reject, controller, done }); pump()
      })
    },
    destroy(): void {
      destroyed = true
      for (const controller of controllers) controller.abort()
      for (const job of queue.splice(0)) { job.done(); job.reject(abortError()) }
    },
  }
}
