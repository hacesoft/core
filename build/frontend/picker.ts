export type PickerType = 'user' | 'group'

export interface PickerItem {
  id: string
  label: string
  type: PickerType
}

export interface PickerOptions {
  endpoint: string
  types?: PickerType[]
  multiple?: boolean
  placeholder?: string
  selected?: PickerItem[]
  onChange?: (aSelected: PickerItem[]) => void
}

export interface PickerController {
  readonly element: HTMLElement
  selected(): PickerItem[]
  setSelected(aItems: PickerItem[]): void
  clear(): void
  destroy(): void
}

export const createPicker = (oElement: HTMLElement, oOptions: PickerOptions): PickerController => {
  let aSelected = [...(oOptions.selected ?? [])]
  let nTimer = 0
  let bDestroyed = false
  const oInput = document.createElement('input')
  const oResults = document.createElement('div')
  const oSelection = document.createElement('div')
  oElement.classList.add('hc-shared-app-core-picker')
  oInput.type = 'search'
  oInput.className = 'hc-shared-app-core-picker__input'
  oInput.placeholder = oOptions.placeholder ?? 'Hledat uživatele nebo skupinu…'
  oInput.setAttribute('aria-label', oInput.placeholder)
  oInput.setAttribute('autocomplete', 'off')
  oResults.className = 'hc-shared-app-core-picker__results'
  oResults.setAttribute('role', 'listbox')
  oSelection.className = 'hc-shared-app-core-picker__selection'
  oElement.append(oSelection, oInput, oResults)

  const fnKey = (oItem: PickerItem): string => oItem.type + ':' + oItem.id
  const fnNotify = (): void => oOptions.onChange?.([...aSelected])
  const fnRenderSelected = (): void => {
    oSelection.replaceChildren()
    for (const oItem of aSelected) {
      const oChip = document.createElement('span')
      oChip.className = 'hc-shared-app-core-picker__chip'
      const oText = document.createElement('span')
      oText.textContent = (oItem.type === 'group' ? 'Skupina: ' : '') + oItem.label
      const oRemove = document.createElement('button')
      oRemove.type = 'button'
      oRemove.textContent = '×'
      oRemove.setAttribute('aria-label', 'Odebrat ' + oItem.label)
      oRemove.addEventListener('click', () => {
        aSelected = aSelected.filter((oEntry) => fnKey(oEntry) !== fnKey(oItem))
        fnRenderSelected()
        fnNotify()
      })
      oChip.append(oText, oRemove)
      oSelection.append(oChip)
    }
  }
  const fnChoose = (oItem: PickerItem): void => {
    if (oOptions.multiple === false) aSelected = [oItem]
    else if (!aSelected.some((oEntry) => fnKey(oEntry) === fnKey(oItem))) aSelected.push(oItem)
    oInput.value = ''
    oResults.replaceChildren()
    fnRenderSelected()
    fnNotify()
    oInput.focus()
  }
  const fnSearch = async (): Promise<void> => {
    const oUrl = new URL(oOptions.endpoint, window.location.href)
    oUrl.searchParams.set('query', oInput.value.trim())
    oUrl.searchParams.set('types', (oOptions.types ?? ['user', 'group']).join(','))
    const oResponse = await fetch(oUrl.toString(), { credentials: 'same-origin', headers: { Accept: 'application/json' } })
    if (!oResponse.ok) throw new Error('Picker search failed with HTTP ' + oResponse.status + '.')
    const oPayload = await oResponse.json() as { items?: PickerItem[] }
    if (bDestroyed) return
    oResults.replaceChildren()
    for (const oItem of oPayload.items ?? []) {
      if (aSelected.some((oEntry) => fnKey(oEntry) === fnKey(oItem))) continue
      const oButton = document.createElement('button')
      oButton.type = 'button'
      oButton.className = 'hc-shared-app-core-picker__result'
      oButton.setAttribute('role', 'option')
      oButton.textContent = (oItem.type === 'group' ? '👥 ' : '👤 ') + oItem.label
      oButton.addEventListener('click', () => fnChoose(oItem))
      oResults.append(oButton)
    }
    if (!oResults.children.length) {
      const oEmpty = document.createElement('p')
      oEmpty.textContent = 'Nenalezeny žádné další položky.'
      oResults.append(oEmpty)
    }
  }
  oInput.addEventListener('input', () => {
    window.clearTimeout(nTimer)
    nTimer = window.setTimeout(() => void fnSearch().catch(() => {
      oResults.textContent = 'Vyhledávání se nezdařilo.'
    }), 250)
  })
  oInput.addEventListener('focus', () => { if (!oResults.children.length) void fnSearch() })
  fnRenderSelected()
  return {
    element: oElement,
    selected: () => [...aSelected],
    setSelected(aItems: PickerItem[]): void { aSelected = [...aItems]; fnRenderSelected(); fnNotify() },
    clear(): void { aSelected = []; fnRenderSelected(); fnNotify() },
    destroy(): void { bDestroyed = true; window.clearTimeout(nTimer); oElement.replaceChildren(); oElement.classList.remove('hc-shared-app-core-picker') },
  }
}

export const picker = Object.freeze({ create: createPicker })
