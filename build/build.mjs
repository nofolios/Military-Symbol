/**
 * build.mjs — produces the two artefacts Figma loads:
 *   dist/code.js  : IIFE bundle for the plugin sandbox (no ESM, no DOM)
 *   dist/ui.html  : a single self-contained HTML file (JS + CSS inlined)
 */
import * as esbuild from 'esbuild'
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const DIST = join(ROOT, 'dist')
const WATCH = process.argv.includes('--watch')
const DEV = WATCH || process.argv.includes('--dev')

mkdirSync(DIST, { recursive: true })

const shared = {
  bundle: true,
  minify: !DEV,
  sourcemap: DEV ? 'inline' : false,
  legalComments: 'none',
  logLevel: 'info',
  define: { 'process.env.NODE_ENV': JSON.stringify(DEV ? 'development' : 'production') },
}

/** Sandbox bundle. Must be a classic script — the Figma sandbox has no module loader. */
const mainCtx = {
  ...shared,
  entryPoints: [join(ROOT, 'src/main/code.ts')],
  outfile: join(DIST, 'code.js'),
  format: 'iife',
  target: ['es2017'],
  platform: 'neutral',
  mainFields: ['module', 'main'],
  conditions: ['import', 'default'],
}

/** UI bundle — built in memory, then inlined into ui.html. */
const uiCtx = {
  ...shared,
  entryPoints: [join(ROOT, 'src/ui/index.tsx')],
  outdir: DIST,
  format: 'iife',
  target: ['chrome100'],
  platform: 'browser',
  jsx: 'automatic',
  jsxImportSource: 'preact',
  loader: { '.json': 'json', '.svg': 'text' },
  write: false,
}

function inlineHtml(outputFiles) {
  const js = outputFiles.find(f => f.path.endsWith('.js'))?.text ?? ''
  const css = outputFiles.find(f => f.path.endsWith('.css'))?.text ?? ''
  const template = readFileSync(join(ROOT, 'src/ui/index.html'), 'utf8')
  const html = template
    .replace('/* __CSS__ */', () => css)
    .replace('/* __JS__ */', () => js)
  writeFileSync(join(DIST, 'ui.html'), html)
  return { jsBytes: js.length, cssBytes: css.length, htmlBytes: html.length }
}

function report() {
  for (const f of ['code.js', 'ui.html']) {
    const p = join(DIST, f)
    if (existsSync(p)) console.log(`  ${f.padEnd(10)} ${(statSync(p).size / 1024).toFixed(1)} KiB`)
  }
}

if (WATCH) {
  const m = await esbuild.context(mainCtx)
  const u = await esbuild.context({
    ...uiCtx,
    plugins: [{
      name: 'inline-html',
      setup(build) {
        build.onEnd(result => {
          if (result.outputFiles) inlineHtml(result.outputFiles)
        })
      },
    }],
  })
  await m.watch()
  await u.watch()
  console.log('watching…')
} else {
  await esbuild.build(mainCtx)
  const res = await esbuild.build(uiCtx)
  const sizes = inlineHtml(res.outputFiles)
  console.log(`\nBuilt:`)
  report()
  console.log(`  (ui js ${(sizes.jsBytes / 1024).toFixed(1)} KiB, css ${(sizes.cssBytes / 1024).toFixed(1)} KiB)`)
}
