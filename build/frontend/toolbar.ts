export type ToolbarActionVariant = 'default' | 'primary' | 'danger'

export interface ToolbarAction {
  id: string
  label: string
  icon?: string
  title?: string
  variant?: ToolbarActionVariant
  disabled?: boolean
  hidden?: boolean
  compact?: boolean
  onClick: () => void | Promise<void>
}

export interface ToolbarOptions {
  ariaLabel?: string
  actions: ToolbarAction[]
}

export interface ToolbarController {
  readonly element: HTMLElement
  update(actions: ToolbarAction[]): void
  setDisabled(id: string, disabled: boolean): void
  destroy(): void
}

const validateActions = (aActions: ToolbarAction[]): void => {
  const oIds = new Set<string>()
  for (const oAction of aActions) {
    if (!oAction.id.trim()) throw new Error('Toolbar action id must not be empty.')
    if (oIds.has(oAction.id)) throw new Error('Toolbar action ids must be unique: ' + oAction.id)
    oIds.add(oAction.id)
  }
}

export const createToolbar = (
  oElement: HTMLElement,
  oOptions: ToolbarOptions,
): ToolbarController => {
  let aActions = [...oOptions.actions]
  let bDestroyed = false

  oElement.classList.add('hc-shared-app-core-toolbar')
  oElement.setAttribute('role', 'toolbar')
  oElement.setAttribute('aria-label', oOptions.ariaLabel ?? 'Nástroje aplikace')

  const fnRender = (): void => {
    if (bDestroyed) return
    validateActions(aActions)
    oElement.replaceChildren()

    for (const oAction of aActions) {
      if (oAction.hidden) continue
      const oButton = document.createElement('button')
      oButton.type = 'button'
      oButton.className = 'hc-shared-app-core-toolbar__action hc-shared-app-core-toolbar__action--' + (oAction.variant ?? 'default')
      oButton.dataset.toolbarAction = oAction.id
      oButton.disabled = oAction.disabled ?? false
      oButton.title = oAction.title ?? oAction.label
      oButton.setAttribute('aria-label', oAction.label)
      if (oAction.compact) oButton.classList.add('hc-shared-app-core-toolbar__action--compact')

      if (oAction.icon) {
        const oIcon = document.createElement('span')
        oIcon.className = 'hc-shared-app-core-toolbar__icon'
        oIcon.setAttribute('aria-hidden', 'true')
        oIcon.textContent = oAction.icon
        oButton.append(oIcon)
      }
      const oLabel = document.createElement('span')
      oLabel.className = 'hc-shared-app-core-toolbar__label'
      oLabel.textContent = oAction.label
      oButton.append(oLabel)
      oButton.addEventListener('click', async () => {
        if (oButton.disabled) return
        oButton.disabled = true
        oButton.setAttribute('aria-busy', 'true')
        try {
          await oAction.onClick()
        } finally {
          oButton.removeAttribute('aria-busy')
          oButton.disabled = oAction.disabled ?? false
        }
      })
      oElement.append(oButton)
    }
  }

  fnRender()
  return {
    element: oElement,
    update(aNewActions: ToolbarAction[]): void {
      aActions = [...aNewActions]
      fnRender()
    },
    setDisabled(sId: string, bDisabled: boolean): void {
      const oAction = aActions.find((oItem) => oItem.id === sId)
      if (!oAction) throw new Error('Unknown toolbar action: ' + sId)
      oAction.disabled = bDisabled
      const oButton = Array.from(oElement.querySelectorAll<HTMLButtonElement>('[data-toolbar-action]'))
        .find((oItem) => oItem.dataset.toolbarAction === sId)
      if (oButton) oButton.disabled = bDisabled
    },
    destroy(): void {
      bDestroyed = true
      oElement.replaceChildren()
      oElement.classList.remove('hc-shared-app-core-toolbar')
      oElement.removeAttribute('role')
      oElement.removeAttribute('aria-label')
    },
  }
}

export const toolbar = Object.freeze({ create: createToolbar })
