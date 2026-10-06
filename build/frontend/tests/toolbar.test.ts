// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest'
import { createToolbar } from '../toolbar'

describe('Toolbar', () => {
  it('renders actions, executes callbacks and updates disabled state', async () => {
    const oElement = document.createElement('nav')
    const fnSave = vi.fn()
    const oController = createToolbar(oElement, {
      ariaLabel: 'Test toolbar',
      actions: [{ id: 'save', label: 'Uložit', icon: '✓', onClick: fnSave }],
    })
    const oButton = oElement.querySelector<HTMLButtonElement>('[data-toolbar-action="save"]')
    expect(oButton?.textContent).toContain('Uložit')
    oButton?.click()
    await Promise.resolve()
    expect(fnSave).toHaveBeenCalledOnce()
    oController.setDisabled('save', true)
    expect(oButton?.disabled).toBe(true)
    oController.destroy()
    expect(oElement.children).toHaveLength(0)
  })

  it('rejects duplicate action ids', () => {
    const oElement = document.createElement('nav')
    expect(() => createToolbar(oElement, {
      actions: [
        { id: 'same', label: 'One', onClick: vi.fn() },
        { id: 'same', label: 'Two', onClick: vi.fn() },
      ],
    })).toThrow('must be unique')
  })
})
