/**
 * make-preview.mjs — renders `assets/preview.svg`, the contact sheet the
 * README shows.
 *
 * The sheet is drawn by the same renderer the plugin uses, with the same two
 * rules that matter (`standard: "APP6"` for the glyph set, and the "14" -> "13"
 * rewrite `renderingSidc()` applies before calling milsymbol), so what a reader
 * sees here is what the plugin inserts.
 *
 * Symbols are positioned on milsymbol's octagon anchor rather than on their
 * bounding box — exactly as `centreOnAnchor()` does in the sandbox — so frames
 * line up across a row even when an echelon mark or a headquarters staff makes
 * one symbol taller than its neighbours.
 *
 * Every symbol is checked before it is written out: it must be a 30-digit
 * APP-6E code, `isValid()`, and draw real icon geometry beyond the bare frame.
 * A failure exits non-zero rather than shipping an empty frame into the README.
 *
 * Usage:  node build/make-preview.mjs [--out <file>]
 */
import ms from 'milsymbol'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const catalog = JSON.parse(readFileSync(join(ROOT, 'src/data/catalog.json'), 'utf8'))

/* ------------------------------------------------------------- render rules */

/**
 * milsymbol 3.0.4 ships `FrameColor.Suspect` as "rbg(255, 188, 1)", which no
 * renderer understands. `src/ui/render.ts` repairs it at load; the sheet has to
 * do the same or every unfilled suspect symbol comes out black.
 */
const frameColors = ms.getColorMode('FrameColor')
if (frameColors && typeof frameColors.Suspect === 'string' && frameColors.Suspect.startsWith('rbg')) {
  ms.setColorMode('FrameColor', { ...frameColors, Suspect: frameColors.Suspect.replace(/^rbg/, 'rgb') })
}

ms.setStandard('APP6')

/** Same rewrite as `renderingSidc()` in src/ui/render.ts. */
const renderingSidc = sidc => (sidc.startsWith('14') ? '13' + sidc.slice(2) : sidc)

const SYMBOL_SIZE = 30
const OPTIONS = { size: SYMBOL_SIZE, standard: 'APP6', infoFields: false }

const symbolOf = sidc => new ms.Symbol(renderingSidc(sidc), OPTIONS)

/** True when the entity draws something beyond the bare frame. */
function hasIconGeometry(sidc) {
  const bare = sidc.slice(0, 10) + '000000' + '0000' + sidc.slice(20, 30)
  const probe = { size: 30, standard: 'APP6', infoFields: false }
  return (
    new ms.Symbol(renderingSidc(sidc), probe).asSVG() !==
    new ms.Symbol(renderingSidc(bare), probe).asSVG()
  )
}

/* -------------------------------------------------------------- sheet content */

const LAND_UNIT = '140310001512110000000000000000' // friendly infantry company
const ARMOUR = '140310001512050000000000000000' // friendly armoured troop

/** Rewrite one field of a SIDC by position (1-based, as the standard counts). */
const at = (sidc, pos, value) => sidc.slice(0, pos - 1) + value + sidc.slice(pos - 1 + value.length)

const affiliation = (sidc, code) => at(sidc, 4, code)
const echelon = (sidc, code) => at(sidc, 9, code)
const status = (sidc, code) => at(sidc, 7, code)
const hqtfd = (sidc, code) => at(sidc, 8, code)

/**
 * The sheet. Each section is a heading plus a row of captioned cells; the
 * spread across symbol sets, affiliations, echelons and status is the point of
 * the picture, so keep it wide rather than deep when adding to it.
 */
const SECTIONS = [
  {
    title: 'Affiliation',
    note: 'digit 4 — the same infantry company, seven standard identities',
    cells: [
      { sidc: affiliation(LAND_UNIT, '0'), label: 'Pending', detail: 'dashed quatrefoil' },
      { sidc: affiliation(LAND_UNIT, '1'), label: 'Unknown', detail: 'quatrefoil' },
      { sidc: affiliation(LAND_UNIT, '2'), label: 'Assumed friend', detail: 'dashed rectangle' },
      { sidc: affiliation(LAND_UNIT, '3'), label: 'Friend', detail: 'rectangle' },
      { sidc: affiliation(LAND_UNIT, '4'), label: 'Neutral', detail: 'square' },
      { sidc: affiliation(LAND_UNIT, '5'), label: 'Suspect', detail: 'dashed diamond' },
      { sidc: affiliation(LAND_UNIT, '6'), label: 'Hostile', detail: 'diamond' },
    ],
  },
  {
    title: 'Echelon',
    note: 'digits 9–10 — an armoured unit from team to corps',
    cells: [
      { sidc: echelon(ARMOUR, '11'), label: 'Team', detail: 'amplifier 11' },
      { sidc: echelon(ARMOUR, '12'), label: 'Squad', detail: 'amplifier 12' },
      { sidc: echelon(ARMOUR, '14'), label: 'Platoon', detail: 'amplifier 14' },
      { sidc: echelon(ARMOUR, '15'), label: 'Company', detail: 'amplifier 15' },
      { sidc: echelon(ARMOUR, '16'), label: 'Battalion', detail: 'amplifier 16' },
      { sidc: echelon(ARMOUR, '18'), label: 'Brigade', detail: 'amplifier 18' },
      { sidc: echelon(ARMOUR, '21'), label: 'Division', detail: 'amplifier 21' },
      { sidc: echelon(ARMOUR, '22'), label: 'Corps', detail: 'amplifier 22' },
    ],
  },
  {
    title: 'Land units',
    note: 'symbol set 10 — Land Unit',
    cells: [
      { sidc: '140310001412110000000000000000', label: 'Infantry', detail: 'platoon' },
      { sidc: '140310001512110200000000000000', label: 'Mech. infantry', detail: 'company' },
      { sidc: '140310001412130000000000000000', label: 'Reconnaissance', detail: 'platoon' },
      { sidc: '140310001613030000000000000000', label: 'Field artillery', detail: 'battalion' },
      { sidc: '140310001514070000000000000000', label: 'Engineer', detail: 'company' },
      { sidc: '140310001511100000000000000000', label: 'Signal', detail: 'company' },
      { sidc: '140310001516130000000000000000', label: 'Medical', detail: 'company' },
      { sidc: '140310001615100000000000000000', label: 'Military intel.', detail: 'battalion' },
    ],
  },
  {
    title: 'Land equipment and installations',
    note: 'symbol sets 15 and 20 — mobility rides in the same field as echelon',
    cells: [
      { sidc: '140315003312020200000000000000', label: 'Medium tank', detail: 'tracked' },
      { sidc: '140315003212010300000000000000', label: 'APC', detail: 'wheeled' },
      { sidc: '140315003511090200000000000000', label: 'Medium howitzer', detail: 'towed' },
      { sidc: '140315003311160000000000000000', label: 'Rocket launcher', detail: 'self-propelled' },
      { sidc: '140315000022030000000000000000', label: 'Radar', detail: 'equipment' },
      { sidc: '140320000012070200000000000000', label: 'Med. treatment', detail: 'installation' },
      { sidc: '140320000012080300000000000000', label: 'Air base', detail: 'installation' },
      { sidc: '140320000012050200000000000000', label: 'Power station', detail: 'installation' },
    ],
  },
  {
    title: 'Air, space and maritime',
    note: 'symbol sets 01, 05, 30, 35 and 36 — the frame follows the symbol set',
    cells: [
      { sidc: '140301000011010400000000000000', label: 'Fighter', detail: 'air' },
      { sidc: '140301000011020000000000000000', label: 'Rotary wing', detail: 'air' },
      { sidc: '140601000011030000000000000000', label: 'UAV', detail: 'air · hostile' },
      { sidc: '140305000011070000000000000000', label: 'Satellite', detail: 'space' },
      { sidc: '140330000012010000000000000000', label: 'Carrier', detail: 'sea surface' },
      { sidc: '140330000012020300000000000000', label: 'Destroyer', detail: 'sea surface' },
      { sidc: '140335000011010000000000000000', label: 'Submarine', detail: 'sea subsurface' },
      { sidc: '140636000011020000000000000000', label: 'Sea mine', detail: 'mine warfare' },
    ],
  },
  {
    title: 'Activities, individuals, control measures and cyberspace',
    note: 'symbol sets 40, 27, 11, 25 and 60',
    cells: [
      { sidc: '140640000011030000000000000000', label: 'IED event', detail: 'activity · hostile' },
      { sidc: '140140000017020200000000000000', label: 'Flood', detail: 'activity · unknown' },
      { sidc: '140327000011021500000000000000', label: 'Infantryman', detail: 'dismounted' },
      { sidc: '140311000011030000000000000000', label: 'Civilian', detail: 'civilian ramp' },
      { sidc: '140325000013030000000000000000', label: 'Checkpoint', detail: 'control measure' },
      { sidc: '140325000016010000000000000000', label: 'Observation post', detail: 'control measure' },
      { sidc: '140360000011030000000000000000', label: 'Cyber protection', detail: 'cyberspace' },
      { sidc: '140652000011030000000000000000', label: 'SIGINT radar', detail: 'SIGINT land' },
    ],
  },
  {
    title: 'Headquarters, task force and status',
    note: 'digits 7 and 8 — drawn on the same infantry battalion',
    cells: [
      { sidc: hqtfd(at(LAND_UNIT, 9, '16'), '2'), label: 'Headquarters', detail: 'staff' },
      { sidc: hqtfd(at(LAND_UNIT, 9, '16'), '4'), label: 'Task force', detail: 'bracket' },
      { sidc: hqtfd(at(LAND_UNIT, 9, '16'), '6'), label: 'Task force HQ', detail: 'both' },
      { sidc: hqtfd(at(LAND_UNIT, 9, '16'), '1'), label: 'Feint / dummy', detail: 'chevron' },
      { sidc: status(at(LAND_UNIT, 9, '16'), '1'), label: 'Planned', detail: 'dashed frame' },
      { sidc: status(at(LAND_UNIT, 9, '16'), '3'), label: 'Damaged', detail: 'condition bar' },
      { sidc: status(at(LAND_UNIT, 9, '16'), '4'), label: 'Destroyed', detail: 'condition bar' },
      { sidc: affiliation(status(at(LAND_UNIT, 9, '16'), '4'), '6'), label: 'Destroyed', detail: 'hostile' },
    ],
  },
]

/* ---------------------------------------------------------------- rendering */

const PAGE = {
  pad: 32,
  columns: 8,
  cellGap: 10,
  captionTop: 8,
  captionLine: 13,
  sectionGap: 26,
  headingHeight: 30,
}

const THEME = {
  background: '#FBFCFD',
  panel: '#FFFFFF',
  border: '#E3E8EE',
  heading: '#101823',
  note: '#6C7885',
  label: '#1B2430',
  detail: '#78838F',
  rule: '#EDF1F5',
}

const escapeXml = s =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const round = n => Math.round(n * 100) / 100

/** Crude but adequate ellipsis: the sheet's own captions are short by design. */
function fit(text, fontSize, maxWidth) {
  const max = Math.floor(maxWidth / (fontSize * 0.55))
  return text.length <= max ? text : text.slice(0, Math.max(1, max - 1)) + '…'
}

/** Nest one milsymbol SVG inside the sheet at (x, y). */
function place(svg, x, y) {
  return svg.replace(/^<svg\b/, `<svg x="${round(x)}" y="${round(y)}"`)
}

function renderCell(cell) {
  const symbol = symbolOf(cell.sidc)
  const problems = []
  if (!/^\d{30}$/.test(cell.sidc)) problems.push('not a 30-digit code')
  if (cell.sidc.slice(0, 2) !== '14') problems.push('not APP-6E (version 14)')
  if (symbol.isValid(false) !== true) problems.push('milsymbol reports the SIDC invalid')
  if (!hasIconGeometry(cell.sidc)) problems.push('draws a bare frame, no icon geometry')

  const size = symbol.getSize()
  const anchor = typeof symbol.getOctagonAnchor === 'function' ? symbol.getOctagonAnchor() : null
  return {
    ...cell,
    problems,
    svg: symbol.asSVG(),
    width: size.width,
    height: size.height,
    anchor: anchor && Number.isFinite(anchor.x) ? anchor : null,
  }
}

function buildSheet() {
  const sections = SECTIONS.map(s => ({ ...s, cells: s.cells.map(renderCell) }))
  const rendered = sections.flatMap(s => s.cells)

  const failures = rendered.filter(c => c.problems.length > 0)
  if (failures.length > 0) {
    for (const f of failures) console.error(`  ✗ ${f.label} (${f.sidc}): ${f.problems.join('; ')}`)
    throw new Error(`${failures.length} symbol(s) would not render; preview not written`)
  }

  // Cells are sized from the tallest symbol on the sheet, so an echelon mark or
  // a headquarters staff never overlaps the caption below it.
  const symbolW = Math.max(...rendered.map(c => c.width))
  const symbolH = Math.max(...rendered.map(c => c.height))
  const cellW = Math.max(112, Math.ceil(symbolW) + 24)
  const symbolAreaH = Math.ceil(symbolH) + 12
  const cellH = symbolAreaH + PAGE.captionTop + PAGE.captionLine * 2

  const gridW = PAGE.columns * cellW + (PAGE.columns - 1) * PAGE.cellGap
  const width = gridW + PAGE.pad * 2
  const headerH = 96

  const parts = []
  let y = PAGE.pad + headerH

  for (const section of sections) {
    parts.push(
      `<text x="${PAGE.pad}" y="${y + 16}" class="h2">${escapeXml(section.title)}</text>`,
      `<text x="${PAGE.pad}" y="${y + 16}" class="note" text-anchor="end" transform="translate(${gridW}, 0)">${escapeXml(section.note)}</text>`,
      `<line x1="${PAGE.pad}" y1="${y + 24}" x2="${PAGE.pad + gridW}" y2="${y + 24}" class="rule"/>`
    )
    y += PAGE.headingHeight

    section.cells.forEach((cell, i) => {
      const col = i % PAGE.columns
      const row = Math.floor(i / PAGE.columns)
      const cx = PAGE.pad + col * (cellW + PAGE.cellGap)
      const cy = y + row * (cellH + PAGE.cellGap)
      const centreX = cx + cellW / 2
      const centreY = cy + symbolAreaH / 2

      const sx = cell.anchor ? centreX - cell.anchor.x : centreX - cell.width / 2
      const sy = cell.anchor ? centreY - cell.anchor.y : centreY - cell.height / 2

      parts.push(
        `<g><title>${escapeXml(cell.label)} — ${cell.sidc}</title>`,
        `<rect x="${cx}" y="${cy}" width="${cellW}" height="${cellH}" rx="8" class="cell"/>`,
        place(cell.svg, sx, sy),
        `<text x="${round(centreX)}" y="${round(cy + symbolAreaH + PAGE.captionTop + 4)}" class="label">${escapeXml(fit(cell.label, 11, cellW - 10))}</text>`,
        `<text x="${round(centreX)}" y="${round(cy + symbolAreaH + PAGE.captionTop + 4 + PAGE.captionLine)}" class="detail">${escapeXml(fit(cell.detail, 9.5, cellW - 10))}</text>`,
        `</g>`
      )
    })

    const rows = Math.ceil(section.cells.length / PAGE.columns)
    y += rows * cellH + (rows - 1) * PAGE.cellGap + PAGE.sectionGap
  }

  const footerY = y + 4
  const height = footerY + 24 + PAGE.pad

  const selectable = catalog.sets.reduce((n, s) => n + s.entities.filter(e => !e.d).length, 0)
  const subtitle =
    `${selectable} selectable entities across ${catalog.sets.length} symbol sets, ` +
    `drawn as editable Figma vectors — every symbol below is a real APP-6E code.`

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${round(height)}" viewBox="0 0 ${width} ${round(height)}" role="img" aria-label="Contact sheet of NATO APP-6E symbols generated by the Military Symbols Figma plugin">`,
    `<style>`,
    `  .h1 { font: 600 22px Inter, "Helvetica Neue", Arial, sans-serif; fill: ${THEME.heading} }`,
    `  .sub { font: 400 12.5px Inter, "Helvetica Neue", Arial, sans-serif; fill: ${THEME.note} }`,
    `  .h2 { font: 600 13px Inter, "Helvetica Neue", Arial, sans-serif; fill: ${THEME.heading} }`,
    `  .note { font: 400 11px Inter, "Helvetica Neue", Arial, sans-serif; fill: ${THEME.note} }`,
    `  .label { font: 500 11px Inter, "Helvetica Neue", Arial, sans-serif; fill: ${THEME.label}; text-anchor: middle }`,
    `  .detail { font: 400 9.5px Inter, "Helvetica Neue", Arial, sans-serif; fill: ${THEME.detail}; text-anchor: middle }`,
    `  .foot { font: 400 10.5px ui-monospace, SFMono-Regular, Menlo, monospace; fill: ${THEME.note} }`,
    `  .cell { fill: ${THEME.panel}; stroke: ${THEME.border} }`,
    `  .rule { stroke: ${THEME.rule}; stroke-width: 1 }`,
    `</style>`,
    `<rect width="100%" height="100%" fill="${THEME.background}"/>`,
    `<text x="${PAGE.pad}" y="${PAGE.pad + 22}" class="h1">Military Symbols</text>`,
    `<text x="${PAGE.pad}" y="${PAGE.pad + 44}" class="sub">NATO APP-6E (STANAG 2019 Edition E) military map symbols for Figma.</text>`,
    `<text x="${PAGE.pad}" y="${PAGE.pad + 62}" class="sub">${escapeXml(subtitle)}</text>`,
    ...parts,
    `<text x="${PAGE.pad}" y="${round(footerY + 12)}" class="foot">npm run preview · rendered with milsymbol 3.x, standard: APP6 · unofficial tool, not endorsed by NATO</text>`,
    `</svg>`,
    '',
  ].join('\n')

  return { svg, count: rendered.length, width, height }
}

/* -------------------------------------------------------------------- main */

const args = process.argv.slice(2)
const outArg = args.indexOf('--out')
const outPath = outArg >= 0 && args[outArg + 1]
  ? (isAbsolute(args[outArg + 1]) ? args[outArg + 1] : join(ROOT, args[outArg + 1]))
  : join(ROOT, 'assets/preview.svg')

const { svg, count, width, height } = buildSheet()
mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, svg)
console.log(
  `make-preview: ${count} symbols in ${SECTIONS.length} sections -> ${outPath.replace(ROOT + '/', '')} ` +
  `(${Math.round(width)}x${Math.round(height)}, ${(Buffer.byteLength(svg) / 1024).toFixed(1)} KiB)`
)
