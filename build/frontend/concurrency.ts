import { dialogs } from './dialogs'

export type ConcurrencyChoice = 'reload' | 'keep-editing' | 'compare' | 'save-copy'
export type TextMergeStatus = 'identical' | 'local-only' | 'remote-only' | 'merged' | 'conflict'

export interface ConflictDialogOptions {
  title: string
  message: string
  reloadLabel: string
  keepEditingLabel: string
  compareLabel?: string
  saveCopyLabel?: string
}

export interface RevisionCarrier {
  expectedRevision?: number | string
  [key: string]: unknown
}

export interface TextMergeResult {
  status: TextMergeStatus
  text: string
}

export interface RevisionWatchOptions {
  initialRevision: number | string
  intervalMs?: number
  pauseWhenHidden?: boolean
  loadRevision: () => Promise<number | string | null | undefined>
  onChange: (change: { previousRevision: number | string, revision: number | string }) => void | Promise<void>
  onError?: (error: unknown) => void
}

export interface RevisionWatchController {
  checkNow(): Promise<boolean>
  setRevision(revision: number | string): void
  getRevision(): number | string
  pause(): void
  resume(): void
  destroy(): void
}

interface TextEdit {
  start: number
  end: number
  replacement: string
}

const normalizeRevision = (revision: number | string): number | string => {
  if (typeof revision === 'number') {
    if (!Number.isSafeInteger(revision) || revision < 0) throw new Error('Invalid revision.')
    return revision
  }
  const value = String(revision).trim()
  if (!value || value.length > 255) throw new Error('Invalid revision.')
  return value
}

const withExpectedRevision = <T extends Record<string, unknown>>(
  payload: T,
  revision: number | string,
): Readonly<T & RevisionCarrier> => Object.freeze({
  ...payload,
  expectedRevision: normalizeRevision(revision),
})

const getStatus = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof Response !== 'undefined' && value instanceof Response) return value.status
  if (typeof value !== 'object' || value === null) return null

  const direct = Number((value as { status?: unknown }).status)
  if (Number.isFinite(direct) && direct > 0) return direct

  const response = (value as { response?: unknown }).response
  if (typeof response === 'object' && response !== null) {
    const nested = Number((response as { status?: unknown }).status)
    if (Number.isFinite(nested) && nested > 0) return nested
  }

  const cause = (value as { cause?: unknown }).cause
  if (cause !== value && cause !== undefined) return getStatus(cause)
  return null
}

const isConflict = (value: unknown): boolean => getStatus(value) === 409

const singleEdit = (base: string, variant: string): TextEdit | null => {
  if (base === variant) return null

  let start = 0
  const maxPrefix = Math.min(base.length, variant.length)
  while (start < maxPrefix && base[start] === variant[start]) start++

  let baseEnd = base.length
  let variantEnd = variant.length
  while (baseEnd > start && variantEnd > start && base[baseEnd - 1] === variant[variantEnd - 1]) {
    baseEnd--
    variantEnd--
  }

  return { start, end: baseEnd, replacement: variant.slice(start, variantEnd) }
}

const editsOverlap = (left: TextEdit, right: TextEdit): boolean => {
  const leftInsert = left.start === left.end
  const rightInsert = right.start === right.end
  if (leftInsert && rightInsert) return left.start === right.start
  if (leftInsert) return left.start > right.start && left.start < right.end
  if (rightInsert) return right.start > left.start && right.start < left.end
  return Math.max(left.start, right.start) < Math.min(left.end, right.end)
}

/**
 * Conservative three-way text merge.
 *
 * It safely merges one contiguous local edit region and one contiguous remote
 * edit region when those regions do not overlap in the common base text.
 * Multiple distant edits can therefore intentionally fall back to conflict;
 * the function prefers a false conflict over silent data loss.
 */
const mergeText = (baseValue: string, localValue: string, remoteValue: string): TextMergeResult => {
  const base = String(baseValue)
  const local = String(localValue)
  const remote = String(remoteValue)

  if (local === remote) return { status: 'identical', text: local }
  if (local === base) return { status: 'remote-only', text: remote }
  if (remote === base) return { status: 'local-only', text: local }

  const localEdit = singleEdit(base, local)
  const remoteEdit = singleEdit(base, remote)
  if (!localEdit || !remoteEdit || editsOverlap(localEdit, remoteEdit)) {
    return { status: 'conflict', text: local }
  }

  const edits = [localEdit, remoteEdit].sort((a, b) => b.start - a.start || b.end - a.end)
  let merged = base
  for (const edit of edits) {
    merged = merged.slice(0, edit.start) + edit.replacement + merged.slice(edit.end)
  }
  return { status: 'merged', text: merged }
}

const resolveConflict = (options: ConflictDialogOptions): Promise<ConcurrencyChoice> => new Promise((resolve) => {
  let settled = false
  const finish = (choice: ConcurrencyChoice): void => {
    if (settled) return
    settled = true
    resolve(choice)
  }

  const actions = [
    { label: options.keepEditingLabel, onClick: () => finish('keep-editing' as const) },
    ...(options.compareLabel
      ? [{ label: options.compareLabel, onClick: () => finish('compare' as const) }]
      : []),
    ...(options.saveCopyLabel
      ? [{ label: options.saveCopyLabel, onClick: () => finish('save-copy' as const) }]
      : []),
    { label: options.reloadLabel, variant: 'primary' as const, onClick: () => finish('reload' as const) },
  ]

  dialogs.open({
    title: options.title,
    content: options.message,
    size: 'small',
    closeLabel: options.keepEditingLabel,
    actions,
    onClose: () => finish('keep-editing'),
  })
})


const watchRevision = (options: RevisionWatchOptions): RevisionWatchController => {
  let currentRevision = normalizeRevision(options.initialRevision)
  const intervalMs = Math.min(60000, Math.max(1000, Number(options.intervalMs || 2000)))
  const pauseWhenHidden = options.pauseWhenHidden !== false
  let paused = false
  let destroyed = false
  let checking = false

  const sameRevision = (left: number | string, right: number | string): boolean => String(left) === String(right)
  const canCheck = (): boolean => {
    if (destroyed || paused || checking) return false
    if (pauseWhenHidden && typeof document !== 'undefined' && document.visibilityState === 'hidden') return false
    return true
  }

  const checkNow = async (): Promise<boolean> => {
    if (!canCheck()) return false
    checking = true
    try {
      const loaded = await options.loadRevision()
      if (loaded === null || loaded === undefined) return false
      const revision = normalizeRevision(loaded)
      if (sameRevision(revision, currentRevision)) return false
      const previousRevision = currentRevision
      await options.onChange({ previousRevision, revision })
      if (!destroyed) currentRevision = revision
      return true
    } catch (error) {
      options.onError?.(error)
      return false
    } finally {
      checking = false
    }
  }

  const timer = typeof window !== 'undefined'
    ? window.setInterval(() => { void checkNow() }, intervalMs)
    : null
  const onVisibility = (): void => {
    if (typeof document !== 'undefined' && document.visibilityState !== 'hidden') void checkNow()
  }
  const onFocus = (): void => { void checkNow() }
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility)
  if (typeof window !== 'undefined') window.addEventListener('focus', onFocus)

  return {
    checkNow,
    setRevision(revision) { currentRevision = normalizeRevision(revision) },
    getRevision: () => currentRevision,
    pause() { paused = true },
    resume() { paused = false; void checkNow() },
    destroy() {
      if (destroyed) return
      destroyed = true
      if (timer !== null && typeof window !== 'undefined') window.clearInterval(timer)
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibility)
      if (typeof window !== 'undefined') window.removeEventListener('focus', onFocus)
    },
  }
}

export const concurrency = Object.freeze({
  withExpectedRevision,
  getStatus,
  isConflict,
  mergeText,
  resolveConflict,
  watchRevision,
})
