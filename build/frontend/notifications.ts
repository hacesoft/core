export type NotificationType = 'success' | 'info' | 'warning' | 'error'
export type NotificationCloseReason = 'timeout' | 'dismiss' | 'clear' | 'overflow'

export interface NotificationAction {
  label: string
  onClick: () => void | Promise<void>
}

export interface NotificationOptions {
  type?: NotificationType
  title?: string
  message: string
  duration?: number
  persistent?: boolean
  dedupeKey?: string
  cooldownMs?: number
  action?: NotificationAction
}

export interface NotificationController {
  readonly id: string
  readonly element: HTMLElement
  readonly closed: Promise<NotificationCloseReason>
  dismiss(): void
}

interface ActiveNotification {
  controller: NotificationController
  options: NotificationOptions
  count: number
  timer?: number
  remaining: number
  startedAt: number
}

const defaultDurations: Record<NotificationType, number> = {
  success: 3500,
  info: 5000,
  warning: 7000,
  error: 9000,
}

class NotificationManager {
  private container: HTMLElement | null = null
  private readonly active: ActiveNotification[] = []
  private readonly queue: NotificationOptions[] = []
  private readonly lastShown = new Map<string, number>()
  private readonly maxVisible = 4
  private sequence = 0

  show(options: NotificationOptions): NotificationController {
    const normalized = { ...options, type: options.type ?? 'info' }
    const key = normalized.dedupeKey
    if (key) {
      const existing = this.active.find((item) => item.options.dedupeKey === key)
      if (existing) {
        existing.count += 1
        this.renderCount(existing)
        this.restartTimer(existing)
        return existing.controller
      }
      const last = this.lastShown.get(key) ?? 0
      if (Date.now() - last < (normalized.cooldownMs ?? 1000)) {
        return this.createSuppressedController()
      }
      this.lastShown.set(key, Date.now())
    }

    if (this.active.length >= this.maxVisible) {
      this.queue.push(normalized)
      return this.createQueuedController(normalized)
    }
    return this.mount(normalized)
  }

  success(message: string, options: Omit<NotificationOptions, 'message' | 'type'> = {}): NotificationController {
    return this.show({ ...options, message, type: 'success' })
  }

  info(message: string, options: Omit<NotificationOptions, 'message' | 'type'> = {}): NotificationController {
    return this.show({ ...options, message, type: 'info' })
  }

  warning(message: string, options: Omit<NotificationOptions, 'message' | 'type'> = {}): NotificationController {
    return this.show({ ...options, message, type: 'warning' })
  }

  error(message: string, options: Omit<NotificationOptions, 'message' | 'type'> = {}): NotificationController {
    return this.show({ ...options, message, type: 'error' })
  }

  clear(): void {
    this.queue.length = 0
    for (const item of [...this.active]) this.close(item, 'clear')
  }

  private mount(options: NotificationOptions): NotificationController {
    const container = this.ensureContainer()
    const element = document.createElement('section')
    const type = options.type ?? 'info'
    element.className = 'hc-shared-app-core-notification hc-shared-app-core-notification--' + type
    element.setAttribute('role', type === 'error' || type === 'warning' ? 'alert' : 'status')
    element.setAttribute('aria-atomic', 'true')

    const icon = document.createElement('span')
    icon.className = 'hc-shared-app-core-notification__icon'
    icon.setAttribute('aria-hidden', 'true')
    icon.textContent = type === 'success' ? '✓' : type === 'warning' ? '!' : type === 'error' ? '×' : 'i'

    const content = document.createElement('div')
    content.className = 'hc-shared-app-core-notification__content'
    if (options.title) {
      const title = document.createElement('strong')
      title.textContent = options.title
      content.append(title)
    }
    const message = document.createElement('p')
    message.textContent = options.message
    content.append(message)
    const count = document.createElement('span')
    count.className = 'hc-shared-app-core-notification__count'
    count.hidden = true
    content.append(count)

    const controls = document.createElement('div')
    controls.className = 'hc-shared-app-core-notification__controls'
    if (options.action) {
      const action = document.createElement('button')
      action.type = 'button'
      action.className = 'hc-shared-app-core-notification__action'
      action.textContent = options.action.label
      action.addEventListener('click', async () => {
        action.disabled = true
        try {
          await options.action?.onClick()
        } finally {
          action.disabled = false
        }
      })
      controls.append(action)
    }
    const dismiss = document.createElement('button')
    dismiss.type = 'button'
    dismiss.className = 'hc-shared-app-core-notification__dismiss'
    dismiss.setAttribute('aria-label', 'Zavřít oznámení')
    dismiss.textContent = '×'
    controls.append(dismiss)
    element.append(icon, content, controls)

    let resolveClosed!: (reason: NotificationCloseReason) => void
    const closed = new Promise<NotificationCloseReason>((resolve) => { resolveClosed = resolve })
    const id = 'notification-' + (++this.sequence)
    element.dataset.notificationId = id
    const controller: NotificationController = {
      id,
      element,
      closed,
      dismiss: () => {
        const item = this.active.find((entry) => entry.controller === controller)
        if (item) this.close(item, 'dismiss', resolveClosed)
      },
    }
    const duration = options.persistent ? 0 : (options.duration ?? defaultDurations[type])
    const item: ActiveNotification = {
      controller,
      options,
      count: 1,
      remaining: duration,
      startedAt: Date.now(),
    }
    ;(item as ActiveNotification & { resolveClosed?: (reason: NotificationCloseReason) => void }).resolveClosed = resolveClosed
    dismiss.addEventListener('click', controller.dismiss)
    element.addEventListener('mouseenter', () => this.pauseTimer(item))
    element.addEventListener('mouseleave', () => this.resumeTimer(item))
    element.addEventListener('focusin', () => this.pauseTimer(item))
    element.addEventListener('focusout', () => this.resumeTimer(item))
    this.active.push(item)
    container.append(element)
    this.startTimer(item)
    requestAnimationFrame(() => element.classList.add('hc-shared-app-core-notification--visible'))
    return controller
  }

  private ensureContainer(): HTMLElement {
    if (this.container?.isConnected) return this.container
    this.container = document.createElement('div')
    this.container.className = 'hc-shared-app-core-notifications'
    this.container.setAttribute('aria-label', 'Oznámení aplikace')
    document.body.append(this.container)
    return this.container
  }

  private startTimer(item: ActiveNotification): void {
    if (item.remaining <= 0) return
    item.startedAt = Date.now()
    item.timer = window.setTimeout(() => this.close(item, 'timeout'), item.remaining)
  }

  private pauseTimer(item: ActiveNotification): void {
    if (!item.timer) return
    window.clearTimeout(item.timer)
    item.timer = undefined
    item.remaining = Math.max(0, item.remaining - (Date.now() - item.startedAt))
  }

  private resumeTimer(item: ActiveNotification): void {
    if (!item.timer && item.remaining > 0) this.startTimer(item)
  }

  private restartTimer(item: ActiveNotification): void {
    if (item.timer) window.clearTimeout(item.timer)
    const type = item.options.type ?? 'info'
    item.remaining = item.options.persistent ? 0 : (item.options.duration ?? defaultDurations[type])
    item.timer = undefined
    this.startTimer(item)
  }

  private renderCount(item: ActiveNotification): void {
    const count = item.controller.element.querySelector<HTMLElement>('.hc-shared-app-core-notification__count')
    if (!count) return
    count.hidden = false
    count.textContent = item.count + '× zopakováno'
  }

  private close(
    item: ActiveNotification,
    reason: NotificationCloseReason,
    resolver?: (reason: NotificationCloseReason) => void,
  ): void {
    if (item.timer) window.clearTimeout(item.timer)
    const index = this.active.indexOf(item)
    if (index < 0) return
    this.active.splice(index, 1)
    item.controller.element.remove()
    const storedResolver = (item as ActiveNotification & {
      resolveClosed?: (reason: NotificationCloseReason) => void
    }).resolveClosed
    ;(resolver ?? storedResolver)?.(reason)
    if (this.active.length === 0 && this.queue.length === 0) {
      this.container?.remove()
      this.container = null
    }
    const next = this.queue.shift()
    if (next) this.mount(next)
  }

  private createSuppressedController(): NotificationController {
    const element = document.createElement('span')
    return {
      id: 'suppressed-' + (++this.sequence),
      element,
      closed: Promise.resolve('overflow'),
      dismiss: () => undefined,
    }
  }

  private createQueuedController(options: NotificationOptions): NotificationController {
    const element = document.createElement('span')
    const id = 'queued-' + (++this.sequence)
    return {
      id,
      element,
      closed: Promise.resolve('overflow'),
      dismiss: () => {
        const index = this.queue.indexOf(options)
        if (index >= 0) this.queue.splice(index, 1)
      },
    }
  }
}

export const notifications = new NotificationManager()
