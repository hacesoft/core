import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const jsDir = fileURLToPath(new URL('../../src/js/', import.meta.url))
const files = await readdir(jsDir)
const maps = files.filter((name) => name.endsWith('.map'))
if (maps.length) {
  throw new Error('Release policy violation: source maps are forbidden in src/js: ' + maps.join(', '))
}

for (const name of files.filter((name) => name.endsWith('.js'))) {
  const source = await readFile(join(jsDir, name), 'utf8')
  if (/sourceMappingURL\s*=/.test(source)) {
    throw new Error('Release policy violation: sourceMappingURL found in src/js/' + name)
  }
}

console.log('Release artifact policy: PASS (no source maps in runtime JS)')
