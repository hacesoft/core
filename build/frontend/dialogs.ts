export type DialogCloseReason = 'action' | 'backdrop' | 'escape' | 'close' | 'programmatic'
export type DialogSize = 'small' | 'medium' | 'large'

export interface DialogController {
  readonly element: HTMLElement
  readonly closed: Promise<DialogCloseReason>
  close(reason?: DialogCloseReason): void
}

export interface DialogAction {
  label: string
  variant?: 'primary' | 'secondary' | 'danger'
  close?: boolean
  onClick?: (dialog: DialogController) => void | Promise<void>
}

export interface DialogOptions {
  title: string
  content: string | Node
  actions?: DialogAction[]
  size?: DialogSize
  closeLabel?: string
  closeOnBackdrop?: boolean
  closeOnEscape?: boolean
  onClose?: (reason: DialogCloseReason) => void
}

export interface ConfirmOptions {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

const focusableSelector = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

class DialogService {
  private readonly stack: DialogController[] = []
  private keyListenerActive = false

  open(options: DialogOptions): DialogController {
    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    const overlay = document.createElement('div')
    overlay.className = 'hc-shared-app-core-dialog-overlay'
    overlay.style.setProperty('--hc-shared-app-core-dialog-layer', String(10000 + this.stack.length * 10))

    const dialog = document.createElement('section')
    const size = options.size ?? 'medium'
    dialog.className = 'hc-shared-app-core-dialog hc-shared-app-core-dialog--' + size
    dialog.setAttribute('role', 'dialog')
    dialog.setAttribute('aria-modal', 'true')

    const titleId = 'hc-shared-app-core-dialog-title-' + crypto.randomUUID()
    dialog.setAttribute('aria-labelledby', titleId)

    const header = document.createElement('header')
    header.className = 'hc-shared-app-core-dialog__header'
    const title = document.createElement('h2')
    title.id = titleId
    title.textContent = options.title
    const closeButton = document.createElement('button')
    closeButton.type = 'button'
    closeButton.className = 'hc-shared-app-core-dialog__close'
    closeButton.setAttribute('aria-label', options.closeLabel ?? 'Close')
    closeButton.textContent = '×'
    header.append(title, closeButton)

    const body = document.createElement('div')
    body.className = 'hc-shared-app-core-dialog__body'
    if (typeof options.content === 'string') {
      const paragraph = document.createElement('p')
      paragraph.textContent = options.content
      body.append(paragraph)
    } else {
      body.append(options.content)
    }

    let resolveClosed!: (reason: DialogCloseReason) => void
    const closed = new Promise<DialogCloseReason>((resolve) => { resolveClosed = resolve })
    let finished = false

    const controller: DialogController = {
      element: dialog,
      closed,
      close: (reason = 'programmatic'): void => {
        if (finished) return
        finished = true
        overlay.remove()
        const index = this.stack.indexOf(controller)
        if (index >= 0) this.stack.splice(index, 1)
        if (this.stack.length === 0) this.removeKeyListener()
        previousFocus?.focus()
        options.onClose?.(reason)
        resolveClosed(reason)
      },
    }

    if (options.actions?.length) {
      const footer = document.createElement('footer')
      footer.className = 'hc-shared-app-core-dialog__actions'
      for (const action of options.actions) {
        const button = document.createElement('button')
        button.type = 'button'
        button.textContent = action.label
        button.className = 'hc-shared-app-core-dialog__action hc-shared-app-core-dialog__action--'
          + (action.variant ?? 'secondary')
        button.addEventListener('click', async () => {
          button.disabled = true
          dialog.setAttribute('aria-busy', 'true')
          try {
            await action.onClick?.(controller)
            if (action.close !== false) controller.close('action')
          } finally {
            button.disabled = false
            dialog.removeAttribute('aria-busy')
          }
        })
        footer.append(button)
      }
      dialog.append(header, body, footer)
    } else {
      dialog.append(header, body)
    }

    closeButton.addEventListener('click', () => controller.close('close'))
    overlay.addEventListener('pointerdown', (event) => {
      if (event.target === overlay && options.closeOnBackdrop !== false) {
        controller.close('backdrop')
      }
    })
    overlay.append(dialog)
    document.body.append(overlay)
    this.stack.push(controller)
    this.installKeyListener(options)

    requestAnimationFrame(() => {
      const first = dialog.querySelector<HTMLElement>(focusableSelector)
      ;(first ?? dialog).focus()
    })
    dialog.tabIndex = -1
    return controller
  }

  confirm(options: ConfirmOptions): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      let decided = false
      const finish = (value: boolean): void => {
        if (decided) return
        decided = true
        resolve(value)
      }
      this.open({
        title: options.title,
        content: options.message,
        size: 'small',
        actions: [
          { label: options.cancelLabel ?? 'Cancel', onClick: () => finish(false) },
          {
            label: options.confirmLabel ?? 'Confirm',
            variant: options.danger ? 'danger' : 'primary',
            onClick: () => finish(true),
          },
        ],
        onClose: () => finish(false),
      })
    })
  }

  closeAll(): void {
    for (const dialog of [...this.stack].reverse()) dialog.close('programmatic')
  }

  private installKeyListener(options: DialogOptions): void {
    ;(this.stack[this.stack.length - 1] as DialogController & { options?: DialogOptions }).options = options
    if (this.keyListenerActive) return
    document.addEventListener('keydown', this.handleKeydown)
    this.keyListenerActive = true
  }

  private removeKeyListener(): void {
    document.removeEventListener('keydown', this.handleKeydown)
    this.keyListenerActive = false
  }

  private readonly handleKeydown = (event: KeyboardEvent): void => {
    const top = this.stack[this.stack.length - 1] as
      | (DialogController & { options?: DialogOptions })
      | undefined
    if (!top) return
    if (event.key === 'Escape' && top.options?.closeOnEscape !== false) {
      event.preventDefault()
      top.close('escape')
      return
    }
    if (event.key !== 'Tab') return
    const focusable = [...top.element.querySelectorAll<HTMLElement>(focusableSelector)]
    if (focusable.length === 0) {
      event.preventDefault()
      top.element.focus()
      return
    }
    const first = focusable[0]!
    const last = focusable[focusable.length - 1]!
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }
}

export const dialogs = new DialogService()

