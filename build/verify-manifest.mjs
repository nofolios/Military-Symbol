/**
 * verify-manifest.mjs — preflight that fails loudly if the plugin would not
 * load in Figma.
 *
 * Importing a broken plugin is a slow round trip: Figma reports one error at a
 * time, in a modal, and some failures (an ESM sandbox bundle, a UI that reaches
 * for the network) only show up once the plugin is already running. So every
 * cheap check is done here instead.
 *
 * What is checked, and why:
 *   - manifest.json parses, and every required field is present and of the
 *     right type (field list: research/04-figma-plugin-platform.md §1.1).
 *   - `main` and `ui` point at files that actually exist on disk, so this is
 *     only meaningful *after* a build.
 *   - dist/code.js contains no top-level ESM syntax. The Figma sandbox is a
 *     plain realm with no module loader, so the bundle must be an IIFE
 *     (research/04 §4).
 *   - dist/ui.html is fully self-contained. `networkAccess.allowedDomains:
 *     ["none"]` blocks the iframe too, so a remote <script>, <link
 *     rel=stylesheet> or @import silently yields an unstyled, dead UI
 *     (research/04 §1.2).
 *   - the byte size of each artefact, with a warning above 4 MB.
 *
 * Usage:  node build/verify-manifest.mjs [--root <dir>] [--quiet]
 * Exit:   0 when clean (warnings are allowed), 1 on any failure.
 */
import { readFileSync, existsSync, statSync } from 'node:fs'
import { dirname, join, isAbsolute, normalize } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = join(HERE, '..')

/** Figma does not publish a hard cap, but anything past this is a smell. */
export const SIZE_WARN_BYTES = 4 * 1024 * 1024

/** Enumerations from research/04-figma-plugin-platform.md §1.1. */
const EDITOR_TYPES = ['figma', 'figjam', 'dev', 'slides', 'buzz']
const CAPABILITIES = ['textreview', 'codegen', 'inspect', 'vscode']
const PERMISSIONS = ['currentuser', 'activeusers', 'fileusers', 'payments', 'teamlibrary']
const KNOWN_KEYS = new Set([
  'name', 'id', 'api', 'main', 'ui', 'editorType', 'documentAccess', 'networkAccess',
  'capabilities', 'permissions', 'menu', 'relaunchButtons', 'parameters', 'parameterOnly',
  'enableProposedApi', 'enablePrivatePluginApi', 'build', 'codeLanguage', 'containsWidget',
  'widgetApi', 'version',
])

/**
 * APIs documented "Available only in Figma Design". Calling one in FigJam or
 * Slides throws at runtime (research/04-figma-plugin-platform.md §1.4).
 */
const DESIGN_ONLY_APIS = ['createComponent', 'combineAsVariants', 'createComponentFromNode']

/** `["*"]` and any local dev server oblige a user-facing `reasoning` string. */
const LOCAL_DOMAIN = /^(https?:\/\/)?(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:\d+)?/i

const isString = v => typeof v === 'string'
const isFilled = v => isString(v) && v.trim().length > 0
const isPlainObject = v => v !== null && typeof v === 'object' && !Array.isArray(v)

function kindOf(v) {
  if (v === null) return 'null'
  if (Array.isArray(v)) return 'array'
  return typeof v
}

function formatBytes(n) {
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(2)} MiB`
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KiB`
  return `${n} B`
}

/**
 * Collect the `ui` entries as [label, relativePath] pairs. `ui` is either a
 * single path (exposed as `__html__`) or a name -> path map (exposed as
 * `__uiFiles__`), so both shapes have to be walked.
 */
function uiEntries(ui) {
  if (isString(ui)) return [['ui', ui]]
  if (isPlainObject(ui)) return Object.entries(ui).map(([k, v]) => [`ui.${k}`, v])
  return []
}

/**
 * Top-level ESM syntax in the sandbox bundle. The bundle is minified onto one
 * line, so anchoring at the start of a line is both sufficient and free of the
 * false positives a bare substring search would produce on string literals.
 */
function findEsmSyntax(source) {
  const hits = []
  const lines = source.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const m = /^\s*(import|export)[\s{*("']/.exec(lines[i])
    if (m) hits.push({ line: i + 1, keyword: m[1], text: lines[i].slice(0, 80).trim() })
  }
  return hits
}

/** Anything the iframe would have to fetch over the network to render. */
const EXTERNAL_UI_PATTERNS = [
  { name: 'external <script src=…>', re: /<script\b[^>]*\bsrc\s*=/i },
  { name: '<link rel="stylesheet">', re: /<link\b[^>]*\brel\s*=\s*["']?stylesheet/i },
  { name: 'remote src="http…"', re: /\bsrc\s*=\s*["']?(?:https?:)?\/\//i },
  { name: 'remote href="http…"', re: /\bhref\s*=\s*["']?https?:\/\//i },
  { name: 'CSS @import of a remote sheet', re: /@import\s+(?:url\()?\s*["']?(?:https?:)?\/\//i },
]

function findExternalRefs(html) {
  return EXTERNAL_UI_PATTERNS.filter(p => p.re.test(html)).map(p => p.name)
}

/**
 * Verify the plugin rooted at `root`. Pure: it reports, it never exits, so
 * package.mjs can call it on both the repository and the staged archive.
 *
 * @param {{root?: string}} options
 * @returns {{root: string, errors: string[], warnings: string[],
 *            artefacts: {label: string, path: string, bytes: number}[],
 *            manifest: object|null}}
 */
export function verifyManifest({ root = PROJECT_ROOT } = {}) {
  const errors = []
  const warnings = []
  const artefacts = []
  const fail = msg => errors.push(msg)
  const warn = msg => warnings.push(msg)

  const manifestPath = join(root, 'manifest.json')
  if (!existsSync(manifestPath)) {
    fail(`manifest.json not found at ${manifestPath}`)
    return { root, errors, warnings, artefacts, manifest: null }
  }

  const raw = readFileSync(manifestPath, 'utf8')
  let manifest
  try {
    manifest = JSON.parse(raw)
  } catch (err) {
    fail(`manifest.json is not valid JSON: ${err.message}`)
    return { root, errors, warnings, artefacts, manifest: null }
  }
  if (!isPlainObject(manifest)) {
    fail(`manifest.json must be a JSON object, got ${kindOf(manifest)}`)
    return { root, errors, warnings, artefacts, manifest: null }
  }
  artefacts.push({ label: 'manifest.json', path: manifestPath, bytes: Buffer.byteLength(raw) })

  // --- required scalar fields -------------------------------------------------
  if (!isFilled(manifest.name)) fail('`name` is required and must be a non-empty string')
  if (!isFilled(manifest.id)) fail('`id` is required and must be a non-empty string (Figma overwrites it on publish)')
  if (manifest.api !== '1.0.0') {
    fail(`\`api\` must be the string "1.0.0" (figma.apiVersion has no other value), got ${JSON.stringify(manifest.api)}`)
  }
  if (!isFilled(manifest.main)) fail('`main` is required and must be a non-empty relative path')

  // --- documentAccess ---------------------------------------------------------
  if (manifest.documentAccess !== 'dynamic-page') {
    fail(`\`documentAccess\` must be "dynamic-page" — it is required for all new plugins, got ${JSON.stringify(manifest.documentAccess)}`)
  }

  // --- editorType -------------------------------------------------------------
  if (!Array.isArray(manifest.editorType) || manifest.editorType.length === 0) {
    fail(`\`editorType\` is required and must be a non-empty array, got ${kindOf(manifest.editorType)}`)
  } else {
    for (const t of manifest.editorType) {
      if (!EDITOR_TYPES.includes(t)) {
        fail(`\`editorType\` contains ${JSON.stringify(t)}; allowed: ${EDITOR_TYPES.join(', ')}`)
      }
    }
  }

  // --- networkAccess ----------------------------------------------------------
  const net = manifest.networkAccess
  if (!isPlainObject(net)) {
    fail(`\`networkAccess\` is required and must be an object, got ${kindOf(net)}`)
  } else {
    const domains = net.allowedDomains
    if (!Array.isArray(domains) || domains.length === 0) {
      fail(`\`networkAccess.allowedDomains\` is required and must be a non-empty array, got ${kindOf(domains)}`)
    } else {
      for (const d of domains) {
        if (!isFilled(d)) fail(`\`networkAccess.allowedDomains\` contains a non-string entry: ${JSON.stringify(d)}`)
      }
      if (domains.includes('none') && domains.length > 1) {
        fail('`networkAccess.allowedDomains` mixes "none" with real domains; "none" must stand alone')
      }
      // `reasoning` is mandatory for a wildcard or a local dev server, and is
      // shown to the user at install time.
      const needsReason = domains.some(d => isString(d) && (d === '*' || LOCAL_DOMAIN.test(d)))
      if (needsReason && !isFilled(net.reasoning)) {
        fail('`networkAccess.reasoning` is required when allowedDomains contains "*" or a local dev server')
      }
    }
    if (net.devAllowedDomains !== undefined && !Array.isArray(net.devAllowedDomains)) {
      fail(`\`networkAccess.devAllowedDomains\` must be an array, got ${kindOf(net.devAllowedDomains)}`)
    }
    if (net.reasoning !== undefined && !isString(net.reasoning)) {
      fail(`\`networkAccess.reasoning\` must be a string, got ${kindOf(net.reasoning)}`)
    }
  }

  // --- optional enumerated arrays --------------------------------------------
  for (const [key, allowed] of [['capabilities', CAPABILITIES], ['permissions', PERMISSIONS]]) {
    const value = manifest[key]
    if (value === undefined) continue
    if (!Array.isArray(value)) {
      fail(`\`${key}\` must be an array, got ${kindOf(value)}`)
      continue
    }
    for (const v of value) {
      if (!allowed.includes(v)) fail(`\`${key}\` contains ${JSON.stringify(v)}; allowed: ${allowed.join(', ')}`)
    }
  }

  // --- relaunchButtons / menu -------------------------------------------------
  if (manifest.relaunchButtons !== undefined) {
    if (!Array.isArray(manifest.relaunchButtons)) {
      fail(`\`relaunchButtons\` must be an array, got ${kindOf(manifest.relaunchButtons)}`)
    } else {
      manifest.relaunchButtons.forEach((b, i) => {
        if (!isPlainObject(b)) return fail(`\`relaunchButtons[${i}]\` must be an object`)
        if (!isFilled(b.command)) fail(`\`relaunchButtons[${i}].command\` is required`)
        if (!isFilled(b.name)) fail(`\`relaunchButtons[${i}].name\` is required`)
        if (b.multipleSelection !== undefined && typeof b.multipleSelection !== 'boolean') {
          fail(`\`relaunchButtons[${i}].multipleSelection\` must be a boolean`)
        }
      })
    }
  }
  if (manifest.menu !== undefined) {
    if (!Array.isArray(manifest.menu)) {
      fail(`\`menu\` must be an array, got ${kindOf(manifest.menu)}`)
    } else {
      manifest.menu.forEach((item, i) => {
        if (!isPlainObject(item)) return fail(`\`menu[${i}]\` must be an object`)
        if (item.separator === true) return
        if (!isFilled(item.name)) fail(`\`menu[${i}].name\` is required`)
        if (!isFilled(item.command) && !Array.isArray(item.menu)) {
          fail(`\`menu[${i}]\` needs either a \`command\` or a nested \`menu\``)
        }
      })
    }
  }

  // `enableProposedApi` is a development-only escape hatch that makes a
  // published plugin fail outright, so it must never survive into a package.
  if (manifest.enableProposedApi) {
    fail('`enableProposedApi` is set; it is development-only and will not work in a published plugin')
  }
  for (const key of Object.keys(manifest)) {
    if (!KNOWN_KEYS.has(key)) warn(`unknown manifest key \`${key}\` — Figma ignores it; typo?`)
  }

  // --- artefacts on disk ------------------------------------------------------
  const targets = []
  if (isFilled(manifest.main)) targets.push(['main', manifest.main])
  if (manifest.ui !== undefined) {
    const entries = uiEntries(manifest.ui)
    if (entries.length === 0) {
      fail(`\`ui\` must be a path or a { name: path } map, got ${kindOf(manifest.ui)}`)
    }
    for (const [label, value] of entries) {
      if (!isFilled(value)) fail(`\`${label}\` must be a non-empty relative path`)
      else targets.push([label, value])
    }
  }

  for (const [label, rel] of targets) {
    if (isAbsolute(rel)) {
      fail(`\`${label}\` must be a path relative to manifest.json, got ${JSON.stringify(rel)}`)
      continue
    }
    if (normalize(rel).startsWith('..')) {
      fail(`\`${label}\` escapes the plugin folder (${JSON.stringify(rel)}); Figma will not load it`)
      continue
    }
    const abs = join(root, rel)
    if (!existsSync(abs)) {
      fail(`\`${label}\` points at ${rel}, which does not exist — run \`npm run build\` first`)
      continue
    }
    const bytes = statSync(abs).size
    artefacts.push({ label: `${label} (${rel})`, path: abs, bytes })
    if (bytes === 0) fail(`${rel} is empty`)
    if (bytes > SIZE_WARN_BYTES) {
      warn(`${rel} is ${formatBytes(bytes)}, above the ${formatBytes(SIZE_WARN_BYTES)} comfort limit — Figma will be slow to load it`)
    }

    // The sandbox bundle must be a classic script.
    if (label === 'main') {
      const source = readFileSync(abs, 'utf8')
      const hits = findEsmSyntax(source)
      for (const h of hits) {
        fail(`${rel}:${h.line} has top-level ESM syntax (\`${h.keyword}\`) — the Figma sandbox has no module loader, the bundle must be an IIFE: ${h.text}`)
      }
      // Figma Design-only APIs in a plugin that also claims FigJam/Slides throw
      // at runtime in those editors, where nothing in the manifest warns you.
      const otherEditors = Array.isArray(manifest.editorType)
        ? manifest.editorType.filter(t => t !== 'figma')
        : []
      if (otherEditors.length > 0) {
        const designOnly = DESIGN_ONLY_APIS.filter(api => source.includes(api))
        if (designOnly.length > 0) {
          warn(`${rel} calls Figma Design-only API(s) (${designOnly.join(', ')}) but editorType also lists ${otherEditors.join(', ')} — guard those calls behind \`figma.editorType === 'figma'\``)
        }
      }
    }

    // The UI must not need the network to render.
    if (label.startsWith('ui') && /\.html?$/i.test(rel)) {
      const refs = findExternalRefs(readFileSync(abs, 'utf8'))
      for (const r of refs) {
        fail(`${rel} is not self-contained: found ${r}. networkAccess blocks it in the iframe; inline the asset instead`)
      }
    }
  }

  return { root, errors, warnings, artefacts, manifest }
}

/** Print a report. Returns true when the result is clean. */
export function reportVerification(result, { quiet = false } = {}) {
  const { errors, warnings, artefacts } = result
  if (!quiet) {
    console.log('verify-manifest: checking plugin artefacts')
    for (const a of artefacts) {
      console.log(`  ok   ${a.label.padEnd(24)} ${formatBytes(a.bytes).padStart(10)}`)
    }
  }
  for (const w of warnings) console.warn(`  WARN ${w}`)
  for (const e of errors) console.error(`  FAIL ${e}`)
  if (errors.length > 0) {
    console.error(`\nverify-manifest: ${errors.length} failure(s) — the plugin would not load in Figma.`)
    return false
  }
  if (!quiet) {
    const suffix = warnings.length > 0 ? ` (${warnings.length} warning(s))` : ''
    console.log(`\nverify-manifest: OK${suffix}`)
  }
  return true
}

// CLI entry point. Only runs when this file is the process entry, so
// package.mjs can import verifyManifest() without triggering a second report.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const rootFlag = process.argv.indexOf('--root')
  const root = rootFlag !== -1 ? process.argv[rootFlag + 1] : PROJECT_ROOT
  const quiet = process.argv.includes('--quiet')
  const ok = reportVerification(verifyManifest({ root }), { quiet })
  process.exit(ok ? 0 : 1)
}

export { formatBytes }
