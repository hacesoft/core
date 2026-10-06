// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'
import { createForm } from '../forms'

describe('Form Engine', () => {
  it('renders fields and reads and writes typed values', () => {
    const oController = createForm([
      { id: 'location', label: 'Místo', type: 'text', value: 'Praha', required: true },
      { id: 'days', label: 'Dny', type: 'number', value: 3, min: 1, max: 10 },
      { id: 'alerts', label: 'Výstrahy', type: 'checkbox', value: true },
      { id: 'units', label: 'Jednotky', type: 'select', value: 'metric', options: [{ value: 'metric', label: 'Metrické' }] },
    ])
    expect(oController.values()).toEqual({ location: 'Praha', days: 3, alerts: true, units: 'metric' })
    oController.setValues({ location: 'Brno', days: 5, alerts: false, units: 'metric' })
    expect(oController.values()).toEqual({ location: 'Brno', days: 5, alerts: false, units: 'metric' })
  })
})
