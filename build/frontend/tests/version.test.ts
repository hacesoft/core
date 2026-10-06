import { describe, expect, it } from 'vitest'
import { isVersionAtLeast } from '../version'

describe('isVersionAtLeast', () => {
  it('accepts equal and newer versions', () => {
    expect(isVersionAtLeast('0.1.0', '0.1.0')).toBe(true)
    expect(isVersionAtLeast('0.2.0', '0.1.9')).toBe(true)
  })

  it('respects prerelease and build precedence', () => {
    expect(isVersionAtLeast('0.15.9-rc.2', '0.15.9')).toBe(false)
    expect(isVersionAtLeast('0.15.9+build.1', '0.15.9')).toBe(true)
    expect(isVersionAtLeast('0.15.90', '0.15.9')).toBe(true)
  })

  it('rejects older and malformed versions', () => {
    expect(isVersionAtLeast('0.1.0', '0.1.1')).toBe(false)
    expect(() => isVersionAtLeast('development', '0.1.0')).toThrow()
  })
})
