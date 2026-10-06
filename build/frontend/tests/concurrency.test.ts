// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest'
import { concurrency } from '../concurrency'

describe('concurrency', () => {
  beforeEach(() => { document.body.replaceChildren() })

  it('adds an expected revision without mutating the source payload', () => {
    const source = { title: 'A' }
    const payload = concurrency.withExpectedRevision(source, 7)
    expect(payload).toEqual({ title: 'A', expectedRevision: 7 })
    expect(source).toEqual({ title: 'A' })
    expect(Object.isFrozen(payload)).toBe(true)
  })

  it('accepts a non-empty opaque string revision', () => {
    expect(concurrency.withExpectedRevision({ value: 1 }, 'etag-17')).toEqual({
      value: 1,
      expectedRevision: 'etag-17',
    })
  })

  it('rejects invalid revisions', () => {
    expect(() => concurrency.withExpectedRevision({}, -1)).toThrow('Invalid revision')
    expect(() => concurrency.withExpectedRevision({}, Number.NaN)).toThrow('Invalid revision')
    expect(() => concurrency.withExpectedRevision({}, '   ')).toThrow('Invalid revision')
  })

  it('recognizes direct and wrapped HTTP 409 errors', () => {
    expect(concurrency.isConflict(409)).toBe(true)
    expect(concurrency.isConflict({ status: 409 })).toBe(true)
    expect(concurrency.isConflict({ response: { status: 409 } })).toBe(true)
    expect(concurrency.isConflict({ cause: { status: 409 } })).toBe(true)
    expect(concurrency.isConflict({ status: 500 })).toBe(false)
    expect(concurrency.getStatus({ response: { status: 412 } })).toBe(412)
  })

  it('merges non-overlapping edits made from the same base', () => {
    const base = 'alpha\nbravo\ncharlie\ndelta\n'
    const local = 'alpha\nBRAVO\ncharlie\ndelta\n'
    const remote = 'alpha\nbravo\ncharlie\nDELTA\n'
    expect(concurrency.mergeText(base, local, remote)).toEqual({
      status: 'merged',
      text: 'alpha\nBRAVO\ncharlie\nDELTA\n',
    })
  })

  it('refuses to merge overlapping edits', () => {
    const base = 'alpha bravo charlie'
    const local = 'alpha LOCAL charlie'
    const remote = 'alpha REMOTE charlie'
    expect(concurrency.mergeText(base, local, remote).status).toBe('conflict')
  })

  it('handles one-sided and identical text changes', () => {
    expect(concurrency.mergeText('a', 'a', 'b')).toEqual({ status: 'remote-only', text: 'b' })
    expect(concurrency.mergeText('a', 'b', 'a')).toEqual({ status: 'local-only', text: 'b' })
    expect(concurrency.mergeText('a', 'b', 'b')).toEqual({ status: 'identical', text: 'b' })
  })

  it('opens the basic standard conflict dialog', async () => {
    const result = concurrency.resolveConflict({
      title: 'Conflict',
      message: 'Changed elsewhere',
      reloadLabel: 'Reload',
      keepEditingLabel: 'Keep editing',
    })
    const buttons = [...document.querySelectorAll<HTMLButtonElement>('.hc-shared-app-core-dialog__action')]
    expect(buttons.map(button => button.textContent)).toEqual(['Keep editing', 'Reload'])
    buttons[1]!.click()
    await expect(result).resolves.toBe('reload')
  })

  it('can expose compare and save-copy choices without implementing app logic', async () => {
    const result = concurrency.resolveConflict({
      title: 'Conflict',
      message: 'Changed elsewhere',
      reloadLabel: 'Reload',
      keepEditingLabel: 'Keep editing',
      compareLabel: 'Compare',
      saveCopyLabel: 'Save copy',
    })
    const buttons = [...document.querySelectorAll<HTMLButtonElement>('.hc-shared-app-core-dialog__action')]
    expect(buttons.map(button => button.textContent)).toEqual([
      'Keep editing', 'Compare', 'Save copy', 'Reload',
    ])
    buttons[2]!.click()
    await expect(result).resolves.toBe('save-copy')
  })

  it('watches revisions, can be updated after a local save and can be destroyed', async () => {
    let remoteRevision = 4
    const changes: Array<[number | string, number | string]> = []
    const watcher = concurrency.watchRevision({
      initialRevision: 3,
      intervalMs: 60000,
      loadRevision: async () => remoteRevision,
      onChange: ({ previousRevision, revision }) => { changes.push([previousRevision, revision]) },
    })
    await watcher.checkNow()
    expect(changes).toEqual([[3, 4]])
    expect(watcher.getRevision()).toBe(4)
    watcher.setRevision(5)
    remoteRevision = 5
    await watcher.checkNow()
    expect(changes).toHaveLength(1)
    watcher.destroy()
  })

})
