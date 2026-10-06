// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createAppLayout,
  createPanel,
  createScrollArea,
  createSplitView,
  createSurface,
  createView,
  observeLayout,
} from '../layout'

class ResizeObserverMock {
  observe = vi.fn()
  disconnect = vi.fn()
}

describe('Layout Primitives', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', ResizeObserverMock)
    vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => {
      fn(1)
      return 1
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
  })

  it('creates a full application shell with stable slots', () => {
    const oRoot = document.createElement('main')
    Object.defineProperty(oRoot, 'getBoundingClientRect', {
      value: () => ({ width: 900, height: 650, top: 0, left: 0, right: 900, bottom: 650 }),
    })
    const oController = createAppLayout(oRoot, {
      header: 'Weather',
      toolbar: 'Views',
      content: 'Forecast',
      topOffset: 50,
    })
    expect(oController.elements.header.textContent).toBe('Weather')
    expect(oController.elements.toolbar.textContent).toBe('Views')
    expect(oController.elements.content.textContent).toBe('Forecast')
    expect(oRoot.dataset.coreLayout).toBe('tablet')
    expect(oRoot.style.getPropertyValue('--hc-shared-app-core-available-height')).not.toBe('')
    oController.destroy()
  })

  it('publishes resize metrics for maps and charts', () => {
    const oElement = document.createElement('div')
    Object.defineProperty(oElement, 'getBoundingClientRect', {
      value: () => ({ width: 1200, height: 700, top: 0, left: 0, right: 1200, bottom: 700 }),
    })
    const fnResize = vi.fn()
    const fnEvent = vi.fn()
    oElement.addEventListener('hc-shared-app-core:layout-resize', fnEvent)
    const oController = observeLayout(oElement, { topOffset: 50, onResize: fnResize })
    const oMetrics = oController.refresh('manual')
    expect(oMetrics.mode).toBe('desktop')
    expect(oMetrics.reason).toBe('manual')
    expect(fnResize).toHaveBeenCalled()
    expect(fnEvent).toHaveBeenCalled()
    oController.destroy()
  })

  it('measures nested allocated height and suppresses unchanged observer notifications', () => {
    const oElement = document.createElement('div')
    Object.defineProperty(oElement, 'getBoundingClientRect', { value: () => ({ width: 500, height: 180, top: 100, left: 0, right: 500, bottom: 280 }) })
    const fnResize = vi.fn()
    const oController = observeLayout(oElement, { heightMode: 'container', onResize: fnResize })
    expect(oController.refresh('container').availableHeight).toBe(180)
    expect(fnResize).toHaveBeenCalledTimes(1)
    oController.refresh('manual'); expect(fnResize).toHaveBeenCalledTimes(2)
    oController.destroy()
  })

  it('keeps the shell height stable during pinch zoom while reporting the visible viewport', () => {
    const oElement = document.createElement('div')
    Object.defineProperty(oElement, 'getBoundingClientRect', { value: () => ({ width: 390, height: 750, top: 50, left: 0, right: 390, bottom: 800 }) })
    vi.stubGlobal('innerHeight', 800)
    const oVisualViewport = {
      height: 400,
      scale: 1,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }
    vi.stubGlobal('visualViewport', oVisualViewport)
    const oController = observeLayout(oElement, { topOffset: 50 })
    expect(oController.refresh('manual').availableHeight).toBe(350)
    oVisualViewport.scale = 2
    const oMetrics = oController.refresh('manual')
    expect(oMetrics.viewportHeight).toBe(400)
    expect(oMetrics.availableHeight).toBe(750)
    expect(oElement.style.getPropertyValue('--hc-shared-app-core-available-height')).toBe('750px')
    oController.destroy()
    vi.unstubAllGlobals()
  })

  it('creates reusable view, panel, scroll, split and surface elements', () => {
    const oView = createView('View')
    const oPanel = createPanel('Panel')
    const oScroll = createScrollArea('Scroll')
    const oSurface = createSurface('Map')
    const oSplit = createSplitView(oPanel, oSurface)
    expect(oView.classList.contains('hc-shared-app-core-view')).toBe(true)
    expect(oScroll.classList.contains('hc-shared-app-core-scroll-area')).toBe(true)
    expect(oSplit.querySelector('.hc-shared-app-core-split-view__primary')).not.toBeNull()
    expect(oSplit.querySelector('.hc-shared-app-core-split-view__secondary')).not.toBeNull()
  })
})
