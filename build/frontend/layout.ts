import { measureWorkspace, resolveWorkspaceMode, type WorkspaceMetrics } from './workspace'

export type LayoutMode = 'mobile' | 'tablet' | 'desktop'
export type LayoutResizeReason = 'initial' | 'container' | 'viewport' | 'orientation' | 'manual'

export interface LayoutMetrics extends WorkspaceMetrics {
  availableHeight: number
  reason: LayoutResizeReason
}

export interface LayoutObserverOptions {
  /** viewport preserves historical topOffset=50; container uses the allocated parent size. */
  heightMode?: 'viewport' | 'container'
  topOffset?: number
  onResize?: (metrics: LayoutMetrics) => void
}

export interface LayoutController {
  readonly element: HTMLElement
  refresh(reason?: LayoutResizeReason): LayoutMetrics
  onResize(listener: (metrics: LayoutMetrics) => void): () => void
  destroy(): void
}

export interface AppLayoutElements {
  root: HTMLElement
  header: HTMLElement
  toolbar: HTMLElement
  content: HTMLElement
}

export interface AppLayoutController extends LayoutController {
  readonly elements: AppLayoutElements
}

export interface AppLayoutOptions extends LayoutObserverOptions {
  header?: Node | string
  toolbar?: Node | string
  content?: Node | string
  ariaLabel?: string
}

export interface SplitViewOptions {
  direction?: 'horizontal' | 'vertical'
  primarySize?: string
  collapseAt?: number
}

const appendContent = (oElement: HTMLElement, mContent?: Node | string): void => {
  if (typeof mContent === 'string') oElement.textContent = mContent
  else if (mContent) oElement.append(mContent)
}

const setLayoutMetrics = (
  oElement: HTMLElement,
  nTopOffset: number,
  sHeightMode: 'viewport' | 'container',
  sReason: LayoutResizeReason,
): LayoutMetrics => {
  const oMeasured = measureWorkspace(oElement)
  // Pinch zoom shrinks visualViewport, but the application shell must keep its
  // layout-viewport height. At scale 1, visualViewport still tracks the soft
  // keyboard and browser chrome as before.
  const nViewportForShell = (window.visualViewport?.scale ?? 1) > 1
    ? window.innerHeight
    : oMeasured.viewportHeight
  const nAvailableHeight = Math.max(0, sHeightMode === 'container' ? oMeasured.height : nViewportForShell - nTopOffset)
  const oMetrics: LayoutMetrics = {
    ...oMeasured,
    availableHeight: Math.round(nAvailableHeight),
    reason: sReason,
  }
  oElement.dataset.coreLayout = oMetrics.mode
  oElement.style.setProperty('--hc-shared-app-core-width', oMetrics.width + 'px')
  oElement.style.setProperty('--hc-shared-app-core-height', oMetrics.height + 'px')
  oElement.style.setProperty('--hc-shared-app-core-viewport-height', oMetrics.viewportHeight + 'px')
  oElement.style.setProperty('--hc-shared-app-core-available-height', oMetrics.availableHeight + 'px')
  oElement.style.setProperty('--hc-shared-app-core-top-offset', nTopOffset + 'px')
  return oMetrics
}

export const observeLayout = (
  oElement: HTMLElement,
  oOptions: LayoutObserverOptions = {},
): LayoutController => {
  const nTopOffset = Math.max(0, oOptions.topOffset ?? 50)
  const oListeners = new Set<(metrics: LayoutMetrics) => void>()
  let bDestroyed = false
  let nFrame = 0
  let sScheduledReason: LayoutResizeReason = 'container'
  let sPreviousMetrics = ''

  if (oOptions.onResize) oListeners.add(oOptions.onResize)

  const fnRefresh = (sReason: LayoutResizeReason = 'manual'): LayoutMetrics => {
    const oMetrics = setLayoutMetrics(oElement, nTopOffset, oOptions.heightMode ?? 'viewport', sReason)
    const sMetrics = JSON.stringify([oMetrics.width, oMetrics.height, oMetrics.availableHeight, oMetrics.viewportHeight, oMetrics.mode])
    if (bDestroyed || (sReason !== 'manual' && sReason !== 'initial' && sMetrics === sPreviousMetrics)) return oMetrics
    sPreviousMetrics = sMetrics
    for (const fnListener of oListeners) fnListener(oMetrics)
    oElement.dispatchEvent(new CustomEvent<LayoutMetrics>('hc-shared-app-core:layout-resize', {
      bubbles: false,
      detail: oMetrics,
    }))
    return oMetrics
  }

  const fnSchedule = (sReason: LayoutResizeReason): void => {
    if (bDestroyed) return
    sScheduledReason = sReason
    if (nFrame) return
    nFrame = window.requestAnimationFrame(() => {
      nFrame = 0
      fnRefresh(sScheduledReason)
    })
  }

  const oResizeObserver = new ResizeObserver(() => fnSchedule('container'))
  const fnViewportResize = (): void => fnSchedule('viewport')
  const fnOrientationChange = (): void => fnSchedule('orientation')
  oResizeObserver.observe(oElement)
  window.visualViewport?.addEventListener('resize', fnViewportResize)
  window.visualViewport?.addEventListener('scroll', fnViewportResize)
  window.addEventListener('resize', fnViewportResize)
  window.addEventListener('orientationchange', fnOrientationChange)

  const oController: LayoutController = {
    element: oElement,
    refresh: fnRefresh,
    onResize(fnListener): () => void {
      oListeners.add(fnListener)
      return () => oListeners.delete(fnListener)
    },
    destroy(): void {
      bDestroyed = true
      if (nFrame) window.cancelAnimationFrame(nFrame)
      oResizeObserver.disconnect()
      window.visualViewport?.removeEventListener('resize', fnViewportResize)
      window.visualViewport?.removeEventListener('scroll', fnViewportResize)
      window.removeEventListener('resize', fnViewportResize)
      window.removeEventListener('orientationchange', fnOrientationChange)
      oListeners.clear()
      delete oElement.dataset.coreLayout
    },
  }
  fnRefresh('initial')
  return oController
}

export const createAppLayout = (
  oElement: HTMLElement,
  oOptions: AppLayoutOptions = {},
): AppLayoutController => {
  oElement.classList.add('hc-shared-app-core-layout')
  if (oOptions.ariaLabel) oElement.setAttribute('aria-label', oOptions.ariaLabel)

  const oHeader = document.createElement('header')
  oHeader.className = 'hc-shared-app-core-layout__header'
  appendContent(oHeader, oOptions.header)
  const oToolbar = document.createElement('nav')
  oToolbar.className = 'hc-shared-app-core-layout__toolbar'
  appendContent(oToolbar, oOptions.toolbar)
  const oContent = document.createElement('div')
  oContent.className = 'hc-shared-app-core-layout__content hc-shared-app-core-view'
  appendContent(oContent, oOptions.content)
  oElement.replaceChildren(oHeader, oToolbar, oContent)

  const oObserver = observeLayout(oElement, oOptions)
  return {
    ...oObserver,
    elements: { root: oElement, header: oHeader, toolbar: oToolbar, content: oContent },
  }
}

export const createView = (mContent?: Node | string): HTMLElement => {
  const oElement = document.createElement('section')
  oElement.className = 'hc-shared-app-core-view'
  appendContent(oElement, mContent)
  return oElement
}

export const createPanel = (mContent?: Node | string): HTMLElement => {
  const oElement = document.createElement('section')
  oElement.className = 'hc-shared-app-core-panel'
  appendContent(oElement, mContent)
  return oElement
}

export const createScrollArea = (mContent?: Node | string): HTMLElement => {
  const oElement = document.createElement('div')
  oElement.className = 'hc-shared-app-core-scroll-area'
  appendContent(oElement, mContent)
  return oElement
}

export const createSurface = (mContent?: Node | string): HTMLElement => {
  const oElement = document.createElement('div')
  oElement.className = 'hc-shared-app-core-surface'
  appendContent(oElement, mContent)
  return oElement
}

export const createSplitView = (
  oPrimary: Node,
  oSecondary: Node,
  oOptions: SplitViewOptions = {},
): HTMLElement => {
  const oElement = document.createElement('div')
  const sDirection = oOptions.direction ?? 'horizontal'
  oElement.className = 'hc-shared-app-core-split-view hc-shared-app-core-split-view--' + sDirection
  oElement.style.setProperty('--hc-shared-app-core-split-primary', oOptions.primarySize ?? 'minmax(220px, 30%)')
  oElement.style.setProperty('--hc-shared-app-core-split-collapse-at', String(oOptions.collapseAt ?? 720))
  const oPrimaryPane = document.createElement('div')
  oPrimaryPane.className = 'hc-shared-app-core-split-view__primary'
  oPrimaryPane.append(oPrimary)
  const oSecondaryPane = document.createElement('div')
  oSecondaryPane.className = 'hc-shared-app-core-split-view__secondary'
  oSecondaryPane.append(oSecondary)
  oElement.append(oPrimaryPane, oSecondaryPane)
  return oElement
}

export const layoutClasses = Object.freeze({
  appLayout: 'hc-shared-app-core-layout',
  header: 'hc-shared-app-core-layout__header',
  toolbar: 'hc-shared-app-core-layout__toolbar',
  content: 'hc-shared-app-core-layout__content',
  view: 'hc-shared-app-core-view',
  panel: 'hc-shared-app-core-panel',
  scrollArea: 'hc-shared-app-core-scroll-area',
  splitView: 'hc-shared-app-core-split-view',
  splitPrimary: 'hc-shared-app-core-split-view__primary',
  splitSecondary: 'hc-shared-app-core-split-view__secondary',
  surface: 'hc-shared-app-core-surface',
})

export const layout = Object.freeze({
  classes: layoutClasses,
  resolveMode: resolveWorkspaceMode,
  observe: observeLayout,
  createAppLayout,
  createView,
  createPanel,
  createScrollArea,
  createSplitView,
  createSurface,
})
