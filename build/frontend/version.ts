export const CORE_VERSION = '0.18.0-dev.16'
export const API_VERSION = 1

// Same SemVer precedence as bootstrap; malformed public input throws.
const fParse = (s: string): { numbers: number[]; pre: string[] } | null => {
  const m = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.exec(s)
  if (!m) return null
  const numbers = m.slice(1, 4).map(Number); const pre = m[4]?.split('.') ?? []
  return numbers.some(n => !Number.isSafeInteger(n)) || pre.some(s => /^0\d+$/.test(s)) ? null : { numbers, pre }
}
export const isVersionAtLeast = (sCurrent: string, sRequired: string): boolean => {
  const a = fParse(sCurrent); const b = fParse(sRequired)
  if (!a || !b) throw new Error('Invalid semantic version.')
  for (let i = 0; i < 3; i++) { const n = a.numbers[i]! - b.numbers[i]!; if (n) return n > 0 }
  if (!a.pre.length || !b.pre.length) return !a.pre.length
  for (let i = 0; i < Math.max(a.pre.length, b.pre.length); i++) {
    const x = a.pre[i]; const y = b.pre[i]
    if (x === y) continue
    if (x === undefined) return false
    if (y === undefined) return true
    const nx = /^\d+$/.test(x); const ny = /^\d+$/.test(y)
    if (nx && ny) return x.length !== y.length ? x.length > y.length : x > y
    return nx !== ny ? !nx : x > y
  }
  return true
}
