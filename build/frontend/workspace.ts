export type WorkspaceMode = 'mobile' | 'tablet' | 'desktop'

export interface WorkspaceMetrics {
  width: number
  height: number
  viewportHeight: number
  mode: WorkspaceMode
  compact: boolean
}

export interface WorkspaceController {
  refresh(): WorkspaceMetrics
  destroy(): void
}

export const resolveWorkspaceMode = (width: number): WorkspaceMode => {
  if (width < 600) return 'mobile'
  if (width < 960) return 'tablet'
  return 'desktop'
}

export const measureWorkspace = (element: HTMLElement): WorkspaceMetrics => {
  const rect = element.getBoundingClientRect()
  const viewportHeight = window.visualViewport?.height ?? window.innerHeight
  const mode = resolveWorkspaceMode(rect.width)
  return {
    width: Math.round(rect.width),
    height: Math.round(rect.height),
    viewportHeight: Math.round(viewportHeight),
    mode,
    compact: mode !== 'desktop',
  }
}

export const observeWorkspace = (
  element: HTMLElement,
  onChange?: (metrics: WorkspaceMetrics) => void,
): WorkspaceController => {
  let destroyed = false
  let frame = 0

  const refresh = (): WorkspaceMetrics => {
    const metrics = measureWorkspace(element)
    element.dataset.coreLayout = metrics.mode
    element.style.setProperty('--hc-shared-app-core-width', metrics.width + 'px')
    element.style.setProperty('--hc-shared-app-core-height', metrics.height + 'px')
    element.style.setProperty('--hc-shared-app-core-viewport-height', metrics.viewportHeight + 'px')
    onChange?.(metrics)
    return metrics
  }

  const schedule = (): void => {
    if (destroyed || frame) return
    frame = window.requestAnimationFrame(() => {
      frame = 0
      refresh()
    })
  }

  const resizeObserver = new ResizeObserver(schedule)
  resizeObserver.observe(element)
  window.visualViewport?.addEventListener('resize', schedule)
  window.addEventListener('orientationchange', schedule)
  refresh()

  return {
    refresh,
    destroy(): void {
      destroyed = true
      if (frame) window.cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      window.visualViewport?.removeEventListener('resize', schedule)
      window.removeEventListener('orientationchange', schedule)
      delete element.dataset.coreLayout
    },
  }
}

export const workspace = Object.freeze({
  resolveMode: resolveWorkspaceMode,
  measure: measureWorkspace,
  observe: observeWorkspace,
})

