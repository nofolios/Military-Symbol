/**
 * build-catalog.mjs
 *
 * Reads the MIT-licensed `milstandard-e` TSV tables (the MIL-STD-2525E /
 * STANAG APP-6E entity + modifier catalogue) and emits a compact JSON
 * catalogue that is bundled into the plugin UI.
 *
 * Output: src/data/catalog.json
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const TSV_DIR = join(ROOT, 'node_modules/milstandard-e/tsv-tables')
const OUT = join(ROOT, 'src/data/catalog.json')

/** Symbol sets of APP-6E, in display order, mapped to their TSV base name. */
const SYMBOL_SETS = [
  { code: '01', name: 'Air',                          tsv: 'Air',                    dimension: 'Air',        group: 'Air' },
  { code: '02', name: 'Air Missile',                  tsv: 'Air missile',            dimension: 'Air',        group: 'Air' },
  { code: '05', name: 'Space',                        tsv: 'Space',                  dimension: 'Space',      group: 'Space' },
  { code: '06', name: 'Space Missile',                tsv: 'Space missile',          dimension: 'Space',      group: 'Space' },
  { code: '10', name: 'Land Unit',                    tsv: 'Land unit',              dimension: 'Ground',     group: 'Land' },
  { code: '11', name: 'Land Civilian Unit/Org',       tsv: 'Land civilian',          dimension: 'Ground',     group: 'Land' },
  { code: '15', name: 'Land Equipment',               tsv: 'Land equipment',         dimension: 'Ground',     group: 'Land' },
  { code: '20', name: 'Land Installation',            tsv: 'Land installation',      dimension: 'Ground',     group: 'Land' },
  { code: '25', name: 'Control Measure',              tsv: 'Control Measures',       dimension: 'Ground',     group: 'Control Measures' },
  { code: '27', name: 'Dismounted Individual',        tsv: 'Dismounted individual',  dimension: 'Ground',     group: 'Land' },
  { code: '30', name: 'Sea Surface',                  tsv: 'Sea surface',            dimension: 'Sea',        group: 'Maritime' },
  { code: '35', name: 'Sea Subsurface',               tsv: 'Sea subsurface',         dimension: 'Subsurface', group: 'Maritime' },
  { code: '36', name: 'Mine Warfare',                 tsv: 'Mine warfare',           dimension: 'Subsurface', group: 'Maritime' },
  { code: '40', name: 'Activity / Event',             tsv: 'Activities',             dimension: 'Ground',     group: 'Activities' },
  { code: '50', name: 'Signals Intelligence – Space', tsv: 'Signals intelligence',   dimension: 'Space',      group: 'SIGINT' },
  { code: '51', name: 'Signals Intelligence – Air',   tsv: 'Signals intelligence',   dimension: 'Air',        group: 'SIGINT' },
  { code: '52', name: 'Signals Intelligence – Land',  tsv: 'Signals intelligence',   dimension: 'Ground',     group: 'SIGINT' },
  { code: '53', name: 'Signals Intelligence – Surface', tsv: 'Signals intelligence', dimension: 'Sea',        group: 'SIGINT' },
  { code: '54', name: 'Signals Intelligence – Subsurface', tsv: 'Signals intelligence', dimension: 'Subsurface', group: 'SIGINT' },
  { code: '60', name: 'Cyberspace',                   tsv: 'Cyberspace',             dimension: 'Ground',     group: 'Cyber' },
]

/** Normalise the odd whitespace / dashes that appear in the source tables. */
function clean(s) {
  return (s ?? '')
    .replace(/ /g, ' ')
    .replace(/–/g, '-')   // en dash used inside words e.g. "Civil–Military"
    .replace(/\s+/g, ' ')
    // A handful of source rows read "Armor /Mechanized" or "Persons/ Refugee":
    // a slash with a space on one side only. Even the spacing out wherever the
    // slash already has whitespace beside it, and leave tight ones like the
    // "and/or" in a remark alone.
    .replace(/\s*\/\s+|\s+\/\s*/g, ' / ')
    .trim()
}

function readTsv(file) {
  const path = join(TSV_DIR, file + '.tsv')
  if (!existsSync(path)) return null
  const text = readFileSync(path, 'utf8').replace(/\r\n?/g, '\n')
  const lines = text.split('\n').filter(l => l.trim().length > 0)
  const header = lines[0].split('\t').map(clean)
  const rows = lines.slice(1).map(l => {
    const cells = l.split('\t')
    const row = {}
    header.forEach((h, i) => { if (h) row[h] = clean(cells[i]) })
    return row
  })
  return { header, rows }
}

/**
 * Entity tables encode a three-level hierarchy by leaving higher-level cells
 * blank on continuation rows. Walk the rows, carrying the last non-empty value
 * at each level forward, and reset deeper levels when a shallower one changes.
 */
function parseEntities(tsv, setCode) {
  if (!tsv) return []
  const out = []
  const carry = ['', '', '']
  const LEVELS = ['Entity', 'Entity Type', 'Entity Subtype']
  for (const row of tsv.rows) {
    const code = clean(row['Code'])
    if (!/^\d{6}$/.test(code)) continue
    for (let i = 0; i < 3; i++) {
      const v = clean(row[LEVELS[i]])
      if (v) {
        carry[i] = v
        for (let j = i + 1; j < 3; j++) carry[j] = ''
      }
    }
    // Some tables repeat the Entity name in the Entity Type column on the
    // level-1 row (e.g. Signals intelligence). Collapse that duplication.
    const path = carry.filter(Boolean)
    const deduped = path.filter((v, i) => i === 0 || v !== path[i - 1])
    const name = deduped[deduped.length - 1] || '(unnamed)'
    const entry = { c: code, n: name }
    // The source tables keep withdrawn codes as "{Disused}" placeholders so the
    // numbering stays stable. They must still decode, but they are noise in a
    // picker, so they are flagged here and filtered out of search.
    if (/^\{disused\}$/i.test(name)) entry.d = 1
    if (deduped.length > 1) entry.p = deduped.slice(0, -1)
    const remarks = clean(row['Remarks'])
    if (remarks) entry.r = remarks
    const geom = clean(row['Geometric Rendering'])
    if (geom) entry.g = geom
    out.push(entry)
  }
  // Guard against duplicate codes within a symbol set.
  const seen = new Map()
  const dupes = []
  for (const e of out) {
    if (seen.has(e.c)) dupes.push(`${setCode}:${e.c}`)
    else seen.set(e.c, e)
  }
  if (dupes.length) console.warn(`  ! duplicate codes in set ${setCode}: ${dupes.slice(0, 6).join(', ')}${dupes.length > 6 ? ` (+${dupes.length - 6})` : ''}`)
  return out
}

function parseModifiers(tsv) {
  if (!tsv) return []
  const out = []
  for (const row of tsv.rows) {
    const code = clean(row['Code'])
    if (!/^\d{2,3}$/.test(code)) continue
    const name = clean(row['First Modifier'] || row['Second Modifier'] || row['Modifier'] || '')
    if (!name) continue
    const e = { c: code.padStart(3, '0'), n: name }
    // The tables keep withdrawn modifiers as "{Disused}" placeholders so the
    // numbering stays stable. Flag them so the pickers can leave them out.
    if (/^\{disused\}$/i.test(name)) e.d = 1
    const cat = clean(row['Category'])
    if (cat) e.cat = cat
    const remarks = clean(row['Remarks'])
    if (remarks) e.r = remarks
    out.push(e)
  }
  return out
}

console.log('Reading APP-6E tables from', TSV_DIR)

const commonM1 = parseModifiers(readTsv('Common Modifiers sector 1'))
const commonM2 = parseModifiers(readTsv('Common Modifiers sector 2'))
console.log(`  common modifiers: sector1=${commonM1.length} sector2=${commonM2.length}`)

const sets = []
let totalEntities = 0
for (const s of SYMBOL_SETS) {
  const entities = parseEntities(readTsv(s.tsv), s.code)
  const m1 = parseModifiers(readTsv(`${s.tsv} sector 1`))
  const m2 = parseModifiers(readTsv(`${s.tsv} sector 2`))
  // Merge common modifiers, set-specific tables win on code collision.
  const merge = (specific, common) => {
    const byCode = new Map(common.map(m => [m.c, { ...m, common: 1 }]))
    for (const m of specific) byCode.set(m.c, m)
    return [...byCode.values()].sort((a, b) => a.c.localeCompare(b.c))
  }
  sets.push({
    code: s.code,
    name: s.name,
    dimension: s.dimension,
    group: s.group,
    entities,
    m1: merge(m1, commonM1),
    m2: merge(m2, commonM2),
  })
  totalEntities += entities.length
  const disused = entities.filter(e => e.d).length
  const disusedMods = [...m1, ...m2].filter(m => m.d).length
  console.log(
    `  set ${s.code} ${s.name.padEnd(34)} entities=${String(entities.length).padStart(4)}` +
    ` (disused ${String(disused).padStart(3)}) m1=${String(m1.length).padStart(3)}` +
    ` m2=${String(m2.length).padStart(3)} (disused ${String(disusedMods).padStart(3)})`
  )
}

const catalog = {
  standard: 'STANAG APP-6E / MIL-STD-2525E',
  source: 'milstandard-e (MIT) — https://github.com/spatialillusions/milstandard-e',
  sets,
}

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, JSON.stringify(catalog))
const bytes = readFileSync(OUT).length
console.log(`\nWrote ${OUT}`)
console.log(`  symbol sets: ${sets.length}`)
console.log(`  entities:    ${totalEntities}`)
console.log(`  size:        ${(bytes / 1024).toFixed(1)} KiB`)
