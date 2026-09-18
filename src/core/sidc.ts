/**
 * APP-6E / MIL-STD-2525E Symbol Identification Code (SIDC).
 *
 * The E editions use a 30-digit numeric SIDC. Digits 1-20 are the classic
 * "D edition" layout; digits 21-30 were added by the E editions, and carry the
 * high-order digit of each sector modifier, a frame-shape override and a
 * reserved tail.
 *
 *   pos  1- 2  Version / standard edition
 *   pos  3     Standard Identity 1 — context (reality / exercise / simulation)
 *   pos  4     Standard Identity 2 — affiliation
 *   pos  5- 6  Symbol set
 *   pos  7     Status / operational condition
 *   pos  8     Headquarters / task force / dummy
 *   pos  9-10  Amplifier / descriptor (echelon, mobility, towed array, leader)
 *   pos 11-12  Entity
 *   pos 13-14  Entity type
 *   pos 15-16  Entity subtype
 *   pos 17-18  Sector 1 modifier — low digits
 *   pos 19-20  Sector 2 modifier — low digits
 *   pos 21     Sector 1 modifier — high digit   (E edition)
 *   pos 22     Sector 2 modifier — high digit   (E edition)
 *   pos 23     Frame shape override             (E edition)
 *   pos 24-30  Reserved                         (E edition)
 *
 * Sector modifiers are therefore three-digit codes: pos21 + pos17-18.
 */

export const SIDC_LENGTH = 30

/** Version digits (positions 1-2). */
export const VERSIONS = [
  { code: '10', label: 'MIL-STD-2525D', edition: 'D', standard: '2525' },
  { code: '11', label: 'STANAG APP-6D', edition: 'D', standard: 'APP6' },
  { code: '13', label: 'MIL-STD-2525E', edition: 'E', standard: '2525' },
  { code: '14', label: 'STANAG APP-6E', edition: 'E', standard: 'APP6' },
] as const

/** The edition this plugin targets. */
export const APP6E_VERSION = '14'

/** Standard Identity 1 — context (position 3). */
export const CONTEXTS = [
  { code: '0', label: 'Reality' },
  { code: '1', label: 'Exercise' },
  { code: '2', label: 'Simulation' },
] as const

/** Standard Identity 2 — affiliation (position 4). */
export const STANDARD_IDENTITIES = [
  { code: '0', label: 'Pending',        frame: 'Unknown', dashed: true  },
  { code: '1', label: 'Unknown',        frame: 'Unknown', dashed: false },
  { code: '2', label: 'Assumed Friend', frame: 'Friend',  dashed: true  },
  { code: '3', label: 'Friend',         frame: 'Friend',  dashed: false },
  { code: '4', label: 'Neutral',        frame: 'Neutral', dashed: false },
  { code: '5', label: 'Suspect / Joker', frame: 'Hostile', dashed: true  },
  { code: '6', label: 'Hostile / Faker', frame: 'Hostile', dashed: false },
] as const

/** Status / operational condition (position 7). */
export const STATUSES = [
  { code: '0', label: 'Present' },
  { code: '1', label: 'Planned / Anticipated / Suspect' },
  { code: '2', label: 'Present — Fully Capable' },
  { code: '3', label: 'Present — Damaged' },
  { code: '4', label: 'Present — Destroyed' },
  { code: '5', label: 'Present — Full to Capacity' },
] as const

/** Headquarters / Task Force / Dummy (position 8). */
export const HQTFD = [
  { code: '0', label: 'Not applicable' },
  { code: '1', label: 'Feint / Dummy' },
  { code: '2', label: 'Headquarters' },
  { code: '3', label: 'Feint / Dummy Headquarters' },
  { code: '4', label: 'Task Force' },
  { code: '5', label: 'Feint / Dummy Task Force' },
  { code: '6', label: 'Task Force Headquarters' },
  { code: '7', label: 'Feint / Dummy Task Force Headquarters' },
] as const

/* Symbol sets each amplifier group applies to — APP-6E §6.2, table 6.2. */
/** Land unit, land civilian, land installation, dismounted individual, activity. */
const ECHELON_SETS = ['10', '11', '20', '27', '40'] as const
/** The same, without the dismounted individual: there is no one-man division. */
const FORMATION_SETS = ['10', '11', '20', '40'] as const
/** Land equipment, dismounted individual, SIGINT land. */
const LAND_MOBILITY_SETS = ['15', '27', '52'] as const
const SNOW_MOBILITY_SETS = ['15', '52'] as const
const WATER_MOBILITY_SETS = ['15', '30', '52', '53'] as const
/** Sea surface, sea subsurface and their SIGINT counterparts. */
const TOWED_ARRAY_SETS = ['30', '35', '53', '54'] as const
/** Leadership is an E-edition addition, and only for the dismounted individual. */
const LEADERSHIP_SETS = ['27'] as const

/**
 * Amplifier / descriptor (positions 9-10), grouped by kind.
 *
 * `sets` is the applicability APP-6E §6.2 gives each amplifier: the symbol sets
 * the standard allows it on, or 'all' for the empty amplifier. milsymbol
 * enforces none of it — it applies one global table to every symbol set and
 * will happily draw a company bar on a frigate — so the pickers gate on this.
 */
export const AMPLIFIERS = [
  { code: '00', label: 'None',                              group: 'None',        sets: 'all' },
  { code: '11', label: 'Team / Crew',                       group: 'Echelon',     sets: ECHELON_SETS },
  { code: '12', label: 'Squad',                             group: 'Echelon',     sets: ECHELON_SETS },
  { code: '13', label: 'Section',                           group: 'Echelon',     sets: ECHELON_SETS },
  { code: '14', label: 'Platoon / Detachment',              group: 'Echelon',     sets: ECHELON_SETS },
  { code: '15', label: 'Company / Battery / Troop',         group: 'Echelon',     sets: ECHELON_SETS },
  { code: '16', label: 'Battalion / Squadron',              group: 'Echelon',     sets: ECHELON_SETS },
  { code: '17', label: 'Regiment / Group',                  group: 'Echelon',     sets: ECHELON_SETS },
  { code: '18', label: 'Brigade',                           group: 'Echelon',     sets: ECHELON_SETS },
  // Division and above: a dismounted individual (27) cannot carry one.
  { code: '21', label: 'Division',                          group: 'Echelon',     sets: FORMATION_SETS },
  { code: '22', label: 'Corps / MEF',                       group: 'Echelon',     sets: FORMATION_SETS },
  { code: '23', label: 'Army',                              group: 'Echelon',     sets: FORMATION_SETS },
  { code: '24', label: 'Army Group / Front',                group: 'Echelon',     sets: FORMATION_SETS },
  { code: '25', label: 'Region / Theater',                  group: 'Echelon',     sets: FORMATION_SETS },
  { code: '26', label: 'Command',                           group: 'Echelon',     sets: FORMATION_SETS },
  { code: '31', label: 'Wheeled, limited cross-country',    group: 'Mobility',    sets: LAND_MOBILITY_SETS },
  { code: '32', label: 'Wheeled, cross-country',            group: 'Mobility',    sets: LAND_MOBILITY_SETS },
  { code: '33', label: 'Tracked',                           group: 'Mobility',    sets: LAND_MOBILITY_SETS },
  { code: '34', label: 'Wheeled and tracked combination',   group: 'Mobility',    sets: LAND_MOBILITY_SETS },
  { code: '35', label: 'Towed',                             group: 'Mobility',    sets: LAND_MOBILITY_SETS },
  { code: '36', label: 'Rail',                              group: 'Mobility',    sets: LAND_MOBILITY_SETS },
  { code: '37', label: 'Pack animals',                      group: 'Mobility',    sets: LAND_MOBILITY_SETS },
  { code: '41', label: 'Over-snow (prime mover)',           group: 'Mobility',    sets: SNOW_MOBILITY_SETS },
  { code: '42', label: 'Sled',                              group: 'Mobility',    sets: SNOW_MOBILITY_SETS },
  { code: '51', label: 'Barge',                             group: 'Mobility',    sets: WATER_MOBILITY_SETS },
  { code: '52', label: 'Amphibious',                        group: 'Mobility',    sets: WATER_MOBILITY_SETS },
  { code: '61', label: 'Short towed array',                 group: 'Towed array', sets: TOWED_ARRAY_SETS },
  { code: '62', label: 'Long towed array',                  group: 'Towed array', sets: TOWED_ARRAY_SETS },
  // The renderer draws one chevron for both of these, and only on a friendly
  // frame; the dashed deputy variant is not implemented upstream.
  { code: '71', label: 'Leader — individual (friend only)',  group: 'Leadership', sets: LEADERSHIP_SETS },
  { code: '72', label: 'Deputy — individual (drawn as leader)', group: 'Leadership', sets: LEADERSHIP_SETS },
] as const

export interface AmplifierOption {
  code: string
  label: string
  group: string
}

/**
 * The amplifiers APP-6E allows on one symbol set. Everything outside this list
 * is an illegal combination that milsymbol would nonetheless draw, which is why
 * it is filtered out of the picker rather than merely warned about.
 */
export function amplifiersForSet(symbolSet: string): AmplifierOption[] {
  return AMPLIFIERS.filter(a => a.sets === 'all' || a.sets.indexOf(symbolSet as never) >= 0)
}

export function amplifierAppliesTo(code: string, symbolSet: string): boolean {
  const a = AMPLIFIERS.find(x => x.code === code)
  if (!a) return false
  return a.sets === 'all' || a.sets.indexOf(symbolSet as never) >= 0
}

/**
 * Frame shape override (position 23). An E-edition addition: it forces a frame
 * family regardless of the symbol set. "A" is the one non-numeric value in the
 * whole SIDC and means "draw no frame at all".
 */
export const FRAME_SHAPES = [
  { code: '0', label: 'From symbol set (default)' },
  { code: '1', label: 'Space' },
  { code: '2', label: 'Air' },
  { code: '3', label: 'Land unit' },
  { code: '4', label: 'Land equipment / sea surface' },
  { code: '5', label: 'Land installation' },
  { code: '6', label: 'Dismounted individual' },
  { code: '7', label: 'Sea subsurface' },
  { code: '8', label: 'Activity / event' },
  { code: '9', label: 'Cyberspace' },
  { code: 'A', label: 'Unframed' },
] as const

export interface Sidc {
  /** positions 1-2 */
  version: string
  /** position 3 — Standard Identity 1 */
  context: string
  /** position 4 — Standard Identity 2 */
  standardIdentity: string
  /** positions 5-6 */
  symbolSet: string
  /** position 7 */
  status: string
  /** position 8 */
  hqtfd: string
  /** positions 9-10 */
  amplifier: string
  /** positions 11-16, six digits */
  entity: string
  /** three digits: position 21 followed by positions 17-18 */
  modifier1: string
  /** three digits: position 22 followed by positions 19-20 */
  modifier2: string
  /** position 23 */
  frameShape: string
  /** positions 24-30 */
  reserved: string
}

export const EMPTY_SIDC: Sidc = {
  version: APP6E_VERSION,
  context: '0',
  standardIdentity: '3',
  symbolSet: '10',
  status: '0',
  hqtfd: '0',
  amplifier: '00',
  entity: '000000',
  modifier1: '000',
  modifier2: '000',
  frameShape: '0',
  reserved: '0000000',
}

/**
 * Position 23 accepts "A" as well as a digit, so it cannot go through the
 * digits-only normaliser without being silently rewritten to "0".
 */
function frameShapeChar(value: string | undefined): string {
  const v = (value ?? '').trim().toUpperCase()
  return /^[0-9A]$/.test(v) ? v : '0'
}

function digits(value: string | undefined, length: number, fallback: string): string {
  const v = (value ?? '').replace(/\D/g, '')
  if (v.length === 0) return fallback
  return v.length >= length ? v.slice(0, length) : v.padStart(length, '0')
}

/** Serialise to the canonical 30-character string. */
export function formatSidc(s: Sidc): string {
  const m1 = digits(s.modifier1, 3, '000')
  const m2 = digits(s.modifier2, 3, '000')
  return [
    digits(s.version, 2, APP6E_VERSION),
    digits(s.context, 1, '0'),
    digits(s.standardIdentity, 1, '0'),
    digits(s.symbolSet, 2, '00'),
    digits(s.status, 1, '0'),
    digits(s.hqtfd, 1, '0'),
    digits(s.amplifier, 2, '00'),
    digits(s.entity, 6, '000000'),
    m1.slice(1),
    m2.slice(1),
    m1.slice(0, 1),
    m2.slice(0, 1),
    frameShapeChar(s.frameShape),
    digits(s.reserved, 7, '0000000'),
  ].join('')
}

/**
 * Parse a SIDC string. Accepts 20-digit (D edition) and 30-digit (E edition)
 * codes, and tolerates separators and short input by right-padding with zeros.
 */
/**
 * Strip formatting from a pasted code. Everything but the frame-shape override
 * in position 23 is numeric, so "A" is the only letter kept.
 */
export function cleanSidcInput(input: string): string {
  return (input ?? '').toUpperCase().replace(/[^0-9A]/g, '')
}

export function parseSidc(input: string): Sidc {
  const raw = cleanSidcInput(input)
  const s = raw.padEnd(SIDC_LENGTH, '0').slice(0, SIDC_LENGTH)
  return {
    version: s.slice(0, 2),
    context: s.slice(2, 3),
    standardIdentity: s.slice(3, 4),
    symbolSet: s.slice(4, 6),
    status: s.slice(6, 7),
    hqtfd: s.slice(7, 8),
    amplifier: s.slice(8, 10),
    entity: s.slice(10, 16),
    modifier1: s.slice(20, 21) + s.slice(16, 18),
    modifier2: s.slice(21, 22) + s.slice(18, 20),
    frameShape: frameShapeChar(s.slice(22, 23)),
    reserved: s.slice(23, 30),
  }
}

export interface SidcProblem {
  field: keyof Sidc | 'length'
  message: string
  severity: 'error' | 'warning'
}

const codeSet = (list: ReadonlyArray<{ code: string }>) => new Set(list.map(x => x.code))
const VERSION_CODES = codeSet(VERSIONS)
const CONTEXT_CODES = codeSet(CONTEXTS)
const SI_CODES = codeSet(STANDARD_IDENTITIES)
const STATUS_CODES = codeSet(STATUSES)
const HQTFD_CODES = codeSet(HQTFD)
const AMPLIFIER_CODES = codeSet(AMPLIFIERS)
const FRAME_SHAPE_CODES = codeSet(FRAME_SHAPES)

/** Structural validation. Entity codes are validated against the catalogue elsewhere. */
export function validateSidc(s: Sidc, knownSymbolSets?: ReadonlySet<string>): SidcProblem[] {
  const out: SidcProblem[] = []
  const bad = (field: keyof Sidc, message: string, severity: SidcProblem['severity'] = 'error') =>
    out.push({ field, message, severity })

  if (!VERSION_CODES.has(s.version)) bad('version', `Unknown version "${s.version}"`, 'warning')
  if (!CONTEXT_CODES.has(s.context)) bad('context', `Context must be 0-2, got "${s.context}"`)
  if (!SI_CODES.has(s.standardIdentity)) bad('standardIdentity', `Standard identity must be 0-6, got "${s.standardIdentity}"`)
  if (!STATUS_CODES.has(s.status)) bad('status', `Status must be 0-5, got "${s.status}"`)
  if (!HQTFD_CODES.has(s.hqtfd)) bad('hqtfd', `HQ/TF/Dummy must be 0-7, got "${s.hqtfd}"`)
  if (!AMPLIFIER_CODES.has(s.amplifier)) bad('amplifier', `Unknown amplifier "${s.amplifier}"`, 'warning')
  if (!FRAME_SHAPE_CODES.has(s.frameShape)) bad('frameShape', `Unknown frame shape "${s.frameShape}"`, 'warning')
  if (knownSymbolSets && !knownSymbolSets.has(s.symbolSet)) {
    bad('symbolSet', `Symbol set "${s.symbolSet}" is not in the APP-6E catalogue`, 'warning')
  }
  if (!/^\d{6}$/.test(s.entity)) bad('entity', `Entity must be six digits, got "${s.entity}"`)
  return out
}

/** Label lookup helpers. */
const labelOf = (list: ReadonlyArray<{ code: string; label: string }>, code: string) =>
  list.find(x => x.code === code)?.label

export const versionLabel = (c: string) => labelOf(VERSIONS, c) ?? `Version ${c}`
export const contextLabel = (c: string) => labelOf(CONTEXTS, c) ?? `Context ${c}`
export const standardIdentityLabel = (c: string) => labelOf(STANDARD_IDENTITIES, c) ?? `Identity ${c}`
export const statusLabel = (c: string) => labelOf(STATUSES, c) ?? `Status ${c}`
export const hqtfdLabel = (c: string) => labelOf(HQTFD, c) ?? `HQ/TF/D ${c}`
export const amplifierLabel = (c: string) => labelOf(AMPLIFIERS, c) ?? `Amplifier ${c}`
export const frameShapeLabel = (c: string) => labelOf(FRAME_SHAPES, c) ?? `Frame ${c}`

/** Which frame family a standard identity resolves to, honouring joker/faker. */
export function frameFamily(s: Sidc): string {
  const si = STANDARD_IDENTITIES.find(x => x.code === s.standardIdentity)
  if (!si) return 'Unknown'
  // Exercise + suspect/hostile renders with a friendly frame (joker / faker).
  if (s.context === '1' && (s.standardIdentity === '5' || s.standardIdentity === '6')) return 'Friend'
  return si.frame
}

/**
 * True when the frame itself is drawn with a dashed line: the uncertain
 * identities (pending, assumed friend, suspect) and planned/anticipated status.
 *
 * Feint and dummy are deliberately not here. They leave the frame solid and add
 * a separate dashed inverted-V above it, which `isFeintOrDummy` reports.
 */
export function isDashedFrame(s: Sidc): boolean {
  const si = STANDARD_IDENTITIES.find(x => x.code === s.standardIdentity)
  return Boolean(si?.dashed) || s.status === '1'
}

/** True when a dashed inverted-V is drawn over the frame. */
export function isFeintOrDummy(s: Sidc): boolean {
  return ['1', '3', '5', '7'].includes(s.hqtfd)
}

/** True when the code carries a headquarters staff. */
export function isHeadquarters(s: Sidc): boolean {
  return ['2', '3', '6', '7'].includes(s.hqtfd)
}

/** True when the code carries a task-force bracket. */
export function isTaskForce(s: Sidc): boolean {
  return ['4', '5', '6', '7'].includes(s.hqtfd)
}

export const withPatch = (s: Sidc, patch: Partial<Sidc>): Sidc => ({ ...s, ...patch })
