/**
 * package.mjs — produce dist/<name>.zip, the archive you hand to someone who
 * should install the plugin without cloning the repository.
 *
 * The archive is *flat*: manifest.json, code.js, ui.html (and LICENSE /
 * THIRD-PARTY.md when they exist) all sit at the root, and the manifest's
 * `main` / `ui` paths are rewritten to match. Unzipping into a folder therefore
 * yields a directory that "Import plugin from manifest…" accepts as-is, with no
 * dist/ subdirectory to preserve.
 *
 * Nothing but Node built-ins and the system `zip` is used — the project has no
 * archiving dependency and is not gaining one.
 *
 * Usage:  node build/package.mjs
 * Exit:   0 on success, 1 if verification fails or `zip` is unavailable.
 */
import { readFileSync, writeFileSync, copyFileSync, existsSync, statSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { verifyManifest, reportVerification, formatBytes } from './verify-manifest.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = join(ROOT, 'dist')
const STAGE = join(DIST, 'package')

/** Files copied verbatim into the archive root when they exist. */
const OPTIONAL_FILES = ['LICENSE', 'LICENSE.md', 'THIRD-PARTY.md']

function die(message) {
  console.error(`package: ${message}`)
  process.exit(1)
}

// --- 1. never package something that would not load ---------------------------
// The archive is only as good as what went into it, so the same preflight that
// `npm run verify` runs guards the zip.
const pre = verifyManifest({ root: ROOT })
if (!reportVerification(pre, { quiet: true })) {
  die('verification failed; not packaging. Run `npm run verify` for the full report.')
}
const manifest = pre.manifest

const pkgJson = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
const zipName = `${pkgJson.name ?? 'plugin'}.zip`
const zipPath = join(DIST, zipName)

// --- 2. stage a flat copy -----------------------------------------------------
rmSync(STAGE, { recursive: true, force: true })
mkdirSync(STAGE, { recursive: true })

const staged = []

/** Copy `relative` (from the repo root) into the archive root under its basename. */
function stage(relative) {
  const name = basename(relative)
  copyFileSync(join(ROOT, relative), join(STAGE, name))
  staged.push(name)
  return name
}

// Rewrite the manifest so its paths resolve inside the flattened archive.
const flat = { ...manifest, main: stage(manifest.main) }
if (typeof manifest.ui === 'string') {
  flat.ui = stage(manifest.ui)
} else if (manifest.ui && typeof manifest.ui === 'object') {
  flat.ui = Object.fromEntries(Object.entries(manifest.ui).map(([k, v]) => [k, stage(v)]))
}
writeFileSync(join(STAGE, 'manifest.json'), JSON.stringify(flat, null, 2) + '\n')
staged.push('manifest.json')

const skipped = []
for (const file of OPTIONAL_FILES) {
  if (existsSync(join(ROOT, file))) stage(file)
  else skipped.push(file)
}
if (skipped.length > 0) console.log(`package: not present, skipped: ${skipped.join(', ')}`)

// --- 3. re-verify the staged tree ---------------------------------------------
// Catches a rewrite that points at a name we did not actually copy.
if (!reportVerification(verifyManifest({ root: STAGE }), { quiet: true })) {
  die('the staged archive does not verify; this is a bug in package.mjs.')
}

// --- 4. zip -------------------------------------------------------------------
rmSync(zipPath, { force: true })
const names = [...new Set(staged)].sort()
// -X drops the extra file attributes that make otherwise identical archives
// differ; -q keeps the output to our own report.
const zip = spawnSync('zip', ['-q', '-X', zipPath, ...names], { cwd: STAGE, encoding: 'utf8' })

if (zip.error && zip.error.code === 'ENOENT') {
  die(
    'the system `zip` command was not found, and the project has no archiving dependency.\n' +
    `        The staged, ready-to-import plugin folder is at ${STAGE}\n` +
    '        Either zip that folder by hand, or install zip (macOS: preinstalled; Debian/Ubuntu: `apt install zip`).',
  )
}
if (zip.error) die(`could not run \`zip\`: ${zip.error.message}`)
if (zip.status !== 0) {
  die(`\`zip\` exited with status ${zip.status}${zip.stderr ? `:\n${zip.stderr.trim()}` : ''}`)
}
if (!existsSync(zipPath)) die(`\`zip\` reported success but ${zipPath} is missing`)

// --- 5. report ----------------------------------------------------------------
const width = Math.max(...names.map(n => n.length), basename(zipPath).length)
console.log('\nPackaged:')
for (const name of names) {
  console.log(`  ${name.padEnd(width)} ${formatBytes(statSync(join(STAGE, name)).size).padStart(10)}`)
}
console.log(`  ${'-'.repeat(width + 11)}`)
console.log(`  ${basename(zipPath).padEnd(width)} ${formatBytes(statSync(zipPath).size).padStart(10)}  compressed`)
console.log(`\n  ${zipPath}`)
console.log(`  staged folder: ${STAGE} (import this directly to test the flattened layout)`)
