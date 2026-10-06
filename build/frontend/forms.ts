export type FormValue = string | number | boolean
export type FormField =
  | { id: string; label: string; type: 'text'; value?: string; required?: boolean; placeholder?: string; maxLength?: number }
  | { id: string; label: string; type: 'number'; value?: number; required?: boolean; min?: number; max?: number; step?: number }
  | { id: string; label: string; type: 'checkbox'; value?: boolean; hint?: string }
  | { id: string; label: string; type: 'select'; value?: string; required?: boolean; options: Array<{ value: string; label: string }> }

export interface FormController {
  readonly element: HTMLFormElement
  values(): Record<string, FormValue>
  setValues(oValues: Record<string, FormValue>): void
  validate(): boolean
  destroy(): void
}

const validateFields = (aFields: FormField[]): void => {
  const oIds = new Set<string>()
  for (const oField of aFields) {
    if (!/^[a-z][a-z0-9_-]*$/i.test(oField.id)) throw new Error('Invalid form field id: ' + oField.id)
    if (oIds.has(oField.id)) throw new Error('Form field ids must be unique: ' + oField.id)
    oIds.add(oField.id)
  }
}

export const createForm = (aFields: FormField[]): FormController => {
  validateFields(aFields)
  const oForm = document.createElement('form')
  oForm.className = 'hc-shared-app-core-form'
  oForm.noValidate = true

  for (const oField of aFields) {
    const oRow = document.createElement('div')
    oRow.className = 'hc-shared-app-core-form__field hc-shared-app-core-form__field--' + oField.type
    let oInput: HTMLInputElement | HTMLSelectElement
    if (oField.type === 'select') {
      const oSelect = document.createElement('select')
      for (const oOptionData of oField.options) {
        const oOption = document.createElement('option')
        oOption.value = oOptionData.value
        oOption.textContent = oOptionData.label
        oSelect.append(oOption)
      }
      oSelect.value = oField.value ?? ''
      oInput = oSelect
    } else {
      const oNativeInput = document.createElement('input')
      oNativeInput.type = oField.type
      if (oField.type === 'checkbox') oNativeInput.checked = oField.value ?? false
      if (oField.type === 'text') {
        oNativeInput.value = oField.value ?? ''
        if (oField.placeholder) oNativeInput.placeholder = oField.placeholder
        if (oField.maxLength !== undefined) oNativeInput.maxLength = oField.maxLength
      }
      if (oField.type === 'number') {
        oNativeInput.value = oField.value === undefined ? '' : String(oField.value)
        if (oField.min !== undefined) oNativeInput.min = String(oField.min)
        if (oField.max !== undefined) oNativeInput.max = String(oField.max)
        if (oField.step !== undefined) oNativeInput.step = String(oField.step)
      }
      oInput = oNativeInput
    }
    oInput.id = 'hc-shared-app-core-field-' + oField.id
    oInput.name = oField.id
    oInput.required = 'required' in oField ? (oField.required ?? false) : false
    const oLabel = document.createElement('label')
    oLabel.htmlFor = oInput.id
    oLabel.textContent = oField.label
    if (oField.type === 'checkbox') oRow.append(oInput, oLabel)
    else oRow.append(oLabel, oInput)
    if (oField.type === 'checkbox' && oField.hint) {
      const oHint = document.createElement('small')
      oHint.textContent = oField.hint
      oRow.append(oHint)
    }
    oForm.append(oRow)
  }

  const fnInputs = (): Array<HTMLInputElement | HTMLSelectElement> =>
    Array.from(oForm.elements).filter((oItem): oItem is HTMLInputElement | HTMLSelectElement =>
      oItem instanceof HTMLInputElement || oItem instanceof HTMLSelectElement)

  return {
    element: oForm,
    values(): Record<string, FormValue> {
      return Object.fromEntries(fnInputs().map((oInput) => {
        const oField = aFields.find((oItem) => oItem.id === oInput.name)
        if (oField?.type === 'checkbox') return [oInput.name, (oInput as HTMLInputElement).checked]
        if (oField?.type === 'number') return [oInput.name, Number(oInput.value)]
        return [oInput.name, oInput.value]
      }))
    },
    setValues(oValues: Record<string, FormValue>): void {
      for (const oInput of fnInputs()) {
        if (!(oInput.name in oValues)) continue
        const xValue = oValues[oInput.name]
        if (oInput instanceof HTMLInputElement && oInput.type === 'checkbox') oInput.checked = Boolean(xValue)
        else oInput.value = String(xValue)
      }
    },
    validate(): boolean { return oForm.reportValidity() },
    destroy(): void { oForm.remove() },
  }
}

export const forms = Object.freeze({ create: createForm })
