import * as esbuild from 'esbuild'
import { readdirSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'dist/test')
mkdirSync(OUT, { recursive: true })

const entries = readdirSync(join(ROOT, 'test'))
  .filter(f => f.endsWith('.test.ts'))
  .map(f => join(ROOT, 'test', f))

await esbuild.build({
  entryPoints: entries,
  outdir: OUT,
  outExtension: { '.js': '.mjs' },
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: ['node20'],
  loader: { '.json': 'json' },
  logLevel: 'warning',
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
})
console.log(`bundled ${entries.length} test file(s) to dist/test`)
