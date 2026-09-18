/**
 * milsymbol wrapper. Runs only in the plugin UI iframe (a real browser
 * context); the Figma sandbox never imports this.
 */
import ms from 'milsymbol'
import type { SymbolOptions } from 'milsymbol'
import type { RenderedSymbol, SymbolSpec, SymbolStyle, TextPlacement } from '../shared/messages'
import { formatSidc, parseSidc, type Sidc } from '../core/sidc'

/** Amplifier fields milsymbol understands, in the order the UI presents them. */
/**
 * Text amplifier fields, with the APP-6E field designator the standard gives
 * each one and the milsymbol option that carries it.
 *
 * Two options milsymbol accepts, `sigint` (R2) and `auxiliaryEquipmentIndicator`
 * (AG), are deliberately absent: both are declared in milsymbol 3.0.4 but never
 * reach a draw instruction, so offering them would be an input that silently
 * does nothing.
 */
export const AMPLIFIER_FIELDS = [
  { key: 'uniqueDesignation',     field: 'T',  label: 'Unique designation',      hint: 'Name or number of the unit, e.g. "2/7 CAV"' },
  { key: 'higherFormation',       field: 'M',  label: 'Higher formation',        hint: 'Parent formation, e.g. "1 BDE"' },
  { key: 'additionalInformation', field: 'H',  label: 'Additional information',  hint: 'Free text' },
  { key: 'staffComments',         field: 'G',  label: 'Staff comments',          hint: 'Free text' },
  { key: 'type',                  field: 'V',  label: 'Type',                    hint: 'Equipment type, e.g. "M1A2"' },
  { key: 'quantity',              field: 'C',  label: 'Quantity',                hint: 'Number of items represented' },
  { key: 'dtg',                   field: 'W',  label: 'Date-time group',         hint: 'e.g. 301400ZSEP97' },
  { key: 'location',              field: 'Y',  label: 'Location',                hint: 'e.g. 0900000.0E570306.0N' },
  { key: 'altitudeDepth',         field: 'X',  label: 'Altitude / depth',        hint: 'Altitude, flight level or depth' },
  { key: 'speed',                 field: 'Z',  label: 'Speed',                   hint: 'Velocity' },
  { key: 'direction',             field: 'Q',  label: 'Direction of movement',   hint: 'Degrees; also draws the movement arrow', numeric: true },
  { key: 'combatEffectiveness',   field: 'K',  label: 'Combat effectiveness',    hint: 'e.g. GREEN' },
  { key: 'signatureEquipment',    field: 'L',  label: 'Signature equipment',     hint: '"!" marks a detectable electronic signature' },
  { key: 'reinforcedReduced',     field: 'F',  label: 'Reinforced / reduced',    hint: '(+) reinforced, (-) reduced. Land units only' },
  { key: 'hostile',               field: 'N',  label: 'Hostile marker',          hint: 'Conventionally "ENY"' },
  { key: 'iffSif',                field: 'P',  label: 'IFF / SIF',               hint: 'Identification modes and codes' },
  { key: 'evaluationRating',      field: 'J',  label: 'Evaluation rating',       hint: 'Reliability letter plus credibility digit, e.g. "A1"' },
  { key: 'specialHeadquarters',   field: 'AA', label: 'Special headquarters',    hint: 'Drawn inside the frame in place of the icon, e.g. "SHAPE"' },
  { key: 'country',               field: 'AC', label: 'Country code',            hint: 'Three letters. Not drawn on land units, and needs another field set too' },
  { key: 'platformType',          field: 'AD', label: 'Platform type',           hint: 'ELNOT or CENOT' },
  { key: 'equipmentTeardownTime', field: 'AE', label: 'Equipment teardown time', hint: 'Minutes' },
  { key: 'commonIdentifier',      field: 'AF', label: 'Common identifier',       hint: 'e.g. "HAWK"' },
  { key: 'headquartersElement',   field: 'AH', label: 'Headquarters element',    hint: 'Drawn below the frame, e.g. "TOC"' },
  { key: 'installationComposition', field: 'AI', label: 'Installation composition', hint: 'Equipment and installations' },
  { key: 'engagementBar',         field: 'AO', label: 'Engagement bar',          hint: 'Target priority bar, e.g. "TA:123"' },
  { key: 'guardedUnit',           field: 'AQ', label: 'Guarded unit',            hint: 'Sea surface only' },
  { key: 'specialDesignator',     field: 'AR', label: 'Special designator',      hint: 'Sea surface and subsurface' },
] as const

export type AmplifierKey = (typeof AMPLIFIER_FIELDS)[number]['key']

export const DEFAULT_STYLE: SymbolStyle = {
  size: 40,
  frame: true,
  fill: true,
  icon: true,
  infoFields: true,
  colorMode: 'Light',
  monoColor: '#000000',
  outlineWidth: 0,
  outlineColor: '#FFFFFF',
  strokeWidth: 3,
  civilianColor: true,
  standard: 'APP6',
  simpleStatusModifier: false,
  padding: 0,
  infoSize: 40,
  outlineText: false,
  square: false,
}

export const FONT_FAMILY = 'Inter'

export type { TextPlacement }

/**
 * milsymbol 3.0.4 ships `FrameColor.Suspect` as "rbg(255, 188, 1)" — a typo for
 * `rgb`, which is not a colour any renderer understands, so an unfilled Suspect
 * symbol loses its amber line and falls back to black in Figma. Repairing the
 * colour mode once at load is the smallest correct fix.
 */
function repairSuspectFrameColour() {
  try {
    const mode = ms.getColorMode('FrameColor')
    if (mode && typeof mode.Suspect === 'string' && mode.Suspect.startsWith('rbg')) {
      ms.setColorMode('FrameColor', { ...mode, Suspect: mode.Suspect.replace(/^rbg/, 'rgb') })
    }
  } catch {
    // a future milsymbol that has fixed this will simply not match
  }
}
repairSuspectFrameColour()

let standardApplied: string | null = null

function applyStandard(standard: 'APP6' | '2525') {
  if (standardApplied !== standard) {
    ms.setStandard(standard)
    standardApplied = standard
  }
}

/**
 * milsymbol 3.0.4 tests the Suspect colour rule with `version == 13`, a numeric
 * comparison that a version of "14" (APP-6E) fails, so Suspect symbols lose
 * their amber fill. Versions "13" and "14" are otherwise byte-identical because
 * both map to edition E, so we render as "13" and keep "14" everywhere the user
 * can see it.
 */
export function renderingSidc(sidc: string): string {
  return sidc.startsWith('14') ? '13' + sidc.slice(2) : sidc
}

/** Translate a SymbolSpec into milsymbol constructor options. */
export function toMilsymbolOptions(spec: SymbolSpec): SymbolOptions {
  const st = spec.style
  const o: SymbolOptions = {
    size: st.size,
    frame: st.frame,
    fill: st.fill,
    icon: st.icon,
    infoFields: st.infoFields,
    infoSize: st.infoSize,
    strokeWidth: st.strokeWidth,
    civilianColor: st.civilianColor,
    simpleStatusModifier: st.simpleStatusModifier,
    padding: st.padding,
    square: st.square,
    standard: st.standard,
    fontfamily: FONT_FAMILY,
  }
  if (st.colorMode === 'mono') {
    o.monoColor = st.monoColor
  } else {
    o.colorMode = st.colorMode
  }
  if (st.outlineWidth > 0) {
    o.outlineWidth = st.outlineWidth
    o.outlineColor = st.outlineColor
  }
  for (const [k, v] of Object.entries(spec.amplifiers)) {
    if (v === '' || v === undefined || v === null) continue
    // `direction` is the only numeric amplifier milsymbol expects.
    ;(o as Record<string, unknown>)[k] = k === 'direction' ? Number(v) : String(v)
  }
  return o
}

export interface RenderOptions {
  /**
   * Target height in px. The scale is baked into milsymbol's own `size` rather
   * than applied afterwards in Figma, so stroke weights stay proportional and
   * no node ever has to be rescaled.
   */
  targetHeight?: number
}

/** Render a spec to SVG plus everything the sandbox needs to rebuild it. */
export function render(spec: SymbolSpec, opts: RenderOptions = {}): RenderedSymbol {
  applyStandard(spec.style.standard)
  const sidc = renderingSidc(spec.sidc)
  let options = toMilsymbolOptions(spec)

  if (opts.targetHeight && opts.targetHeight > 0) {
    const probe = new ms.Symbol(sidc, { ...options, size: 100 })
    const h100 = probe.getSize().height
    if (h100 > 0.01) options = { ...options, size: (100 * opts.targetHeight) / h100 }
  }

  const symbol = new ms.Symbol(sidc, options)
  const svg = symbol.asSVG()
  const size = symbol.getSize()
  const valid = symbol.isValid(false) === true
  const { texts, stripped, width, height } = extractText(svg, size)

  let anchor: { x: number; y: number } | null = null
  try {
    const a = symbol.getOctagonAnchor?.()
    if (a && Number.isFinite(a.x) && Number.isFinite(a.y)) anchor = { x: a.x, y: a.y }
  } catch {
    anchor = null
  }

  return {
    spec,
    svg,
    geometrySvg: stripped,
    texts,
    width: width || size.width,
    height: height || size.height,
    anchor,
    valid,
    hasIcon: hasIconGeometry(spec.sidc, spec.style.standard),
    undefinedIcon: svg.indexOf(UNDEFINED_ICON_PATH) >= 0,
  }
}

/** Quick render used by the live preview and thumbnails; returns raw SVG only. */
export function renderSvg(spec: SymbolSpec): string {
  applyStandard(spec.style.standard)
  return new ms.Symbol(renderingSidc(spec.sidc), toMilsymbolOptions(spec)).asSVG()
}

const undefinedIconCache = new Map<string, boolean>()

/**
 * True when this code has no point symbol at all and the renderer would draw
 * its question-mark glyph. Cached, because whole-catalogue sweeps ask for it.
 */
export function hasUndefinedIcon(sidc: string, standard: 'APP6' | '2525' = 'APP6'): boolean {
  const key = `${standard}:${sidc}`
  const cached = undefinedIconCache.get(key)
  if (cached !== undefined) return cached
  applyStandard(standard)
  let result = false
  try {
    const svg = new ms.Symbol(renderingSidc(sidc), { size: 30, infoFields: false, standard }).asSVG()
    result = svg.indexOf(UNDEFINED_ICON_PATH) >= 0
  } catch {
    result = true
  }
  undefinedIconCache.set(key, result)
  return result
}

const drawableCache = new Map<string, boolean>()

/**
 * True when milsymbol will draw this code as a real point symbol.
 *
 * It is false in two cases, and they have to be tested together: the renderer
 * either refuses the code outright (`isValid`) or accepts it and paints its
 * question-mark glyph, which is what most of symbol set 25 does. Either way the
 * result is not a symbol anyone wants on a map, so this is the one gate every
 * insert path passes through. Cached, because whole-set sheets ask for it in
 * bulk.
 */
export function canDraw(sidc: string, standard: 'APP6' | '2525' = 'APP6'): boolean {
  const key = `${standard}:${sidc}`
  const cached = drawableCache.get(key)
  if (cached !== undefined) return cached
  applyStandard(standard)
  let result = false
  try {
    const symbol = new ms.Symbol(renderingSidc(sidc), { size: 30, infoFields: false, standard })
    result = symbol.isValid(false) === true && symbol.asSVG().indexOf(UNDEFINED_ICON_PATH) < 0
  } catch {
    result = false
  }
  drawableCache.set(key, result)
  return result
}

/** The same verdict for an already-rendered symbol, without re-rendering it. */
export function isDrawable(symbol: RenderedSymbol): boolean {
  return symbol.valid && !symbol.undefinedIcon
}

const iconCache = new Map<string, boolean>()

/**
 * True when the entity code draws something beyond the bare frame. Compared
 * against the same SIDC with a zeroed entity code, with all amplifiers off so
 * only the icon geometry can differ.
 */
export function hasIconGeometry(sidc: string, standard: 'APP6' | '2525' = 'APP6'): boolean {
  const key = `${standard}:${sidc}`
  const cached = iconCache.get(key)
  if (cached !== undefined) return cached
  applyStandard(standard)
  const probe: SymbolOptions = { size: 30, infoFields: false, standard }
  const parsed = parseSidc(sidc)
  const bare = formatSidc({ ...parsed, entity: '000000', modifier1: '000', modifier2: '000' })
  let result = false
  try {
    const a = new ms.Symbol(renderingSidc(formatSidc(parsed)), probe).asSVG()
    const b = new ms.Symbol(renderingSidc(bare), probe).asSVG()
    result = a !== b
  } catch {
    result = false
  }
  iconCache.set(key, result)
  return result
}

const TEXT_RE = /<text\b([^>]*)>([\s\S]*?)<\/text>/g

/**
 * The opening of milsymbol's "undefined icon" glyph — the question mark it
 * draws when an entity code has no point symbol. Matching the path is the only
 * way to tell that case apart from a symbol that is merely plain.
 */
const UNDEFINED_ICON_PATH = 'm 94.8206,78.1372'
const ATTR_RE = /([\w-]+)\s*=\s*"([^"]*)"/g

function parseAttrs(s: string): Record<string, string> {
  const out: Record<string, string> = {}
  let m: RegExpExecArray | null
  ATTR_RE.lastIndex = 0
  while ((m = ATTR_RE.exec(s))) out[m[1]] = m[2]
  return out
}

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
}

/**
 * Pull `<text>` out of the SVG and convert its user-space coordinates into the
 * pixel coordinates of the frame Figma will create.
 */
export function extractText(svg: string, size: { width: number; height: number }) {
  const rootMatch = svg.match(/<svg\b([^>]*)>/)
  const rootAttrs = rootMatch ? parseAttrs(rootMatch[1]) : {}
  const width = parseFloat(rootAttrs.width) || size.width
  const height = parseFloat(rootAttrs.height) || size.height
  const vb = (rootAttrs.viewBox || '').split(/[\s,]+/).map(Number)
  const viewBox = vb.length === 4 && vb.every(n => Number.isFinite(n))
    ? { x: vb[0], y: vb[1], w: vb[2], h: vb[3] }
    : { x: 0, y: 0, w: width, h: height }

  const sx = viewBox.w ? width / viewBox.w : 1
  const sy = viewBox.h ? height / viewBox.h : 1

  /**
   * With a contrast outline enabled milsymbol emits each amplifier twice: an
   * outlined copy first, then the real one painted over it. Both match, so the
   * placements are keyed by content and position and the later one wins.
   */
  const byPlacement = new Map<string, TextPlacement>()
  let m: RegExpExecArray | null
  TEXT_RE.lastIndex = 0
  while ((m = TEXT_RE.exec(svg))) {
    const attrs = parseAttrs(m[1])
    const characters = decodeEntities(m[2].replace(/<[^>]*>/g, '')).trim()
    if (!characters) continue
    const ux = parseFloat(attrs.x) || 0
    const uy = parseFloat(attrs.y) || 0
    // `|| 40` would turn a deliberate font-size of 0 into full-size text, which
    // is exactly what happens when a user sets the amplifier size to nothing.
    const parsedSize = parseFloat(attrs['font-size'])
    const fs = Number.isFinite(parsedSize) ? parsedSize : 40
    if (fs <= 0) continue
    const rawAnchor = attrs['text-anchor']
    const placement: TextPlacement = {
      characters,
      x: (ux - viewBox.x) * sx,
      baselineY: (uy - viewBox.y) * sy,
      fontSize: Math.max(1, fs * sy),
      anchor: rawAnchor === 'middle' || rawAnchor === 'end' ? rawAnchor : 'start',
      baseline: attrs['dominant-baseline'] === 'middle' ? 'middle' : 'alphabetic',
      bold: /^(bold|[6-9]00)$/i.test(attrs['font-weight'] || ''),
      color: attrs.fill && attrs.fill !== 'none' ? attrs.fill : '#000000',
    }
    const key = [
      placement.characters,
      Math.round(placement.x * 10),
      Math.round(placement.baselineY * 10),
      Math.round(placement.fontSize * 10),
      placement.anchor,
      placement.baseline,
    ].join('|')
    byPlacement.set(key, placement)
  }
  const texts = [...byPlacement.values()]

  const stripped = svg.replace(TEXT_RE, '')
  return { texts, stripped, viewBox, width, height }
}

/** Convenience: build a spec from its parts. */
export function makeSpec(
  sidc: Sidc | string,
  amplifiers: Record<string, string | number>,
  style: SymbolStyle,
  label: string
): SymbolSpec {
  return {
    sidc: typeof sidc === 'string' ? sidc : formatSidc(sidc),
    amplifiers,
    style,
    label,
  }
}
