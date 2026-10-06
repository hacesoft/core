import { describe, expect, it } from 'vitest'
import { resolveWorkspaceMode } from '../workspace'

describe('resolveWorkspaceMode', () => {
  it('uses stable container breakpoints', () => {
    expect(resolveWorkspaceMode(375)).toBe('mobile')
    expect(resolveWorkspaceMode(599)).toBe('mobile')
    expect(resolveWorkspaceMode(600)).toBe('tablet')
    expect(resolveWorkspaceMode(959)).toBe('tablet')
    expect(resolveWorkspaceMode(960)).toBe('desktop')
    expect(resolveWorkspaceMode(1440)).toBe('desktop')
  })
})

