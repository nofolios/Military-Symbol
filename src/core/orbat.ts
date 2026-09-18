/**
 * ORBAT trees from indented text.
 *
 * Drawing an order of battle by hand is the slowest job in this whole domain:
 * a brigade with three battalions is already forty symbols, each one needing
 * the right echelon and a connector to its parent. This module turns an
 * indented outline into a laid-out tree, so the UI only has to render symbols
 * and the sandbox only has to place boxes and draw lines.
 *
 * Pure: no DOM, no Figma, no milsymbol.
 */
import { AMPLIFIERS, STANDARD_IDENTITIES, cleanSidcInput, formatSidc, parseSidc, type Sidc } from './sidc'

export interface OrbatNode {
  id: string
  parentId: string | null
  depth: number
  label: string
  /** 30-digit SIDC, resolved from the line's own tokens and its ancestors */
  sidc: string
  children: OrbatNode[]
  /** line number in the source text, 1-based, for error reporting */
  line: number
}

export interface OrbatProblem {
  line: number
  text: string
  message: string
}

export interface ParseResult {
  roots: OrbatNode[]
  problems: OrbatProblem[]
  count: number
}

/* --------------------------------------------------------------- tokenising */

/** Echelon names accepted in a line, mapped to SIDC positions 9-10. */
const ECHELON_ALIASES: Record<string, string> = {
  team: '11', crew: '11',
  squad: '12',
  section: '13',
  platoon: '14', det: '14', detachment: '14',
  company: '15', coy: '15', battery: '15', bty: '15', troop: '15',
  battalion: '16', bn: '16', squadron: '16', sqn: '16',
  regiment: '17', regt: '17', group: '17', grp: '17',
  brigade: '18', bde: '18',
  division: '21', div: '21',
  corps: '22',
  army: '23',
  armygroup: '24', front: '24',
  region: '25', theater: '25', theatre: '25',
  command: '26', cmd: '26',
}

/** Affiliation names accepted in a line, mapped to SIDC position 4. */
const AFFILIATION_ALIASES: Record<string, string> = {
  pending: '0',
  unknown: '1', unk: '1',
  assumedfriend: '2', assumed: '2',
  friend: '3', friendly: '3', blue: '3',
  neutral: '4', green: '4',
  suspect: '5',
  hostile: '6', enemy: '6', red: '6',
  joker: '5',
  faker: '6',
}

/**
 * A joker is a suspect and a faker a hostile, but only inside an exercise:
 * both need the context digit set to Exercise as well, or milsymbol draws an
 * ordinary suspect or hostile diamond instead of the friendly frame with its
 * J or K.
 */
const FORCES_EXERCISE = new Set(['joker', 'faker'])

/** Context names accepted in a line, mapped to SIDC position 3. */
const CONTEXT_ALIASES: Record<string, string> = {
  reality: '0', real: '0',
  exercise: '1', exercise1: '1', ex: '1',
  simulation: '2', simulated: '2', sim: '2',
}

const ECHELON_CODES: ReadonlySet<string> = new Set<string>(AMPLIFIERS.map(a => a.code))
const AFFILIATION_CODES: ReadonlySet<string> = new Set<string>(STANDARD_IDENTITIES.map(s => s.code))

const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

interface LineTokens {
  label: string
  sidc?: string
  echelon?: string
  affiliation?: string
  /** standard identity 1: reality, exercise or simulation */
  context?: string
  entity?: string
  hq?: boolean
  taskForce?: boolean
  unknownTokens: string[]
}

/**
 * A line is `Label` optionally followed by `|`-separated directives:
 *
 *     1 BDE | 140310001812110000000000000000
 *     1-7 IN | bn | infantry-entity 121100
 *     A CO | company | hq
 *     OPFOR recce | hostile | platoon
 *
 * A directive is a full SIDC, an echelon name or code, an affiliation name or
 * code, a six-digit entity code, `hq`, or `tf`.
 */
export function parseLine(raw: string): LineTokens {
  const parts = raw.split('|').map(p => p.trim())
  const out: LineTokens = { label: parts[0] ?? '', unknownTokens: [] }

  for (const token of parts.slice(1)) {
    if (!token) continue
    const digits = token.replace(/\D/g, '')
    const code = cleanSidcInput(token)
    const key = normalise(token)

    if (code.length >= 20 && code.length === token.replace(/[\s-]/g, '').length) {
      out.sidc = code
      continue
    }
    if (key === 'hq' || key === 'headquarters') { out.hq = true; continue }
    if (key === 'tf' || key === 'taskforce') { out.taskForce = true; continue }
    if (ECHELON_ALIASES[key]) { out.echelon = ECHELON_ALIASES[key]; continue }
    if (CONTEXT_ALIASES[key]) { out.context = CONTEXT_ALIASES[key]; continue }
    if (AFFILIATION_ALIASES[key]) {
      out.affiliation = AFFILIATION_ALIASES[key]
      if (FORCES_EXERCISE.has(key)) out.context = '1'
      continue
    }
    if (/^\d{2}$/.test(digits) && ECHELON_CODES.has(digits)) { out.echelon = digits; continue }
    if (/^\d$/.test(digits) && AFFILIATION_CODES.has(digits)) { out.affiliation = digits; continue }
    if (/^\d{6}$/.test(digits)) { out.entity = digits; continue }
    out.unknownTokens.push(token)
  }
  return out
}

/** Width of a line's leading indentation, counting a tab as two spaces. */
export function indentWidth(line: string): number {
  let n = 0
  for (const ch of line) {
    if (ch === ' ') n += 1
    else if (ch === '\t') n += 2
    else break
  }
  return n
}

/**
 * Parse an indented outline into a forest.
 *
 * Indentation is compared against the stack of open ancestors rather than
 * assuming a fixed step, so two spaces, four spaces and tabs all work, and
 * mixing them only matters if the result is genuinely ambiguous.
 */
export function parseOrbat(text: string, base: Sidc): ParseResult {
  const roots: OrbatNode[] = []
  const problems: OrbatProblem[] = []
  const stack: { indent: number; node: OrbatNode }[] = []
  let counter = 0
  let count = 0

  const lines = text.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i]
    const lineNo = i + 1
    if (!rawLine.trim() || rawLine.trim().startsWith('#')) continue

    const indent = indentWidth(rawLine)
    const tokens = parseLine(rawLine.trim())
    if (!tokens.label) {
      problems.push({ line: lineNo, text: rawLine.trim(), message: 'No label on this line' })
      continue
    }
    for (const t of tokens.unknownTokens) {
      problems.push({ line: lineNo, text: rawLine.trim(), message: `Directive "${t}" not understood` })
    }

    while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop()
    const parent = stack.length ? stack[stack.length - 1].node : null

    // Inherit the parent's code, then apply this line's own directives.
    const inherited = parent ? parseSidc(parent.sidc) : { ...base }
    let sidc: Sidc = tokens.sidc ? parseSidc(tokens.sidc) : { ...inherited }
    if (tokens.entity) sidc = { ...sidc, entity: tokens.entity }
    if (tokens.echelon) sidc = { ...sidc, amplifier: tokens.echelon }
    else if (!tokens.sidc && parent) {
      // A subordinate is by definition smaller than its parent, so inheriting
      // the parent's echelon would draw a company as a brigade. Say nothing and
      // the unit gets no size amplifier at all, which is at least not a lie.
      sidc = { ...sidc, amplifier: '00' }
    }
    if (tokens.affiliation) sidc = { ...sidc, standardIdentity: tokens.affiliation }
    if (tokens.context) sidc = { ...sidc, context: tokens.context }
    if (tokens.hq || tokens.taskForce) {
      const hq = tokens.hq ? 2 : 0
      const tf = tokens.taskForce ? 4 : 0
      sidc = { ...sidc, hqtfd: String(hq + tf) }
    } else if (!tokens.sidc && parent) {
      // An inherited HQ flag would silently mark every subordinate as an HQ.
      sidc = { ...sidc, hqtfd: '0' }
    }

    const node: OrbatNode = {
      id: `n${++counter}`,
      parentId: parent ? parent.id : null,
      depth: parent ? parent.depth + 1 : 0,
      label: tokens.label,
      sidc: formatSidc(sidc),
      children: [],
      line: lineNo,
    }
    count++

    if (parent) parent.children.push(node)
    else roots.push(node)
    stack.push({ indent, node })
  }

  return { roots, problems, count }
}

/* ------------------------------------------------------------------ layout */

export interface LayoutMetrics {
  /** width of one symbol cell */
  cellWidth: number
  /** height of one symbol cell, excluding the label */
  cellHeight: number
  /** height reserved under each symbol for its label */
  labelHeight: number
  /** horizontal gap between sibling subtrees */
  hGap: number
  /** vertical gap between generations */
  vGap: number
}

export const DEFAULT_METRICS: LayoutMetrics = {
  cellWidth: 120,
  cellHeight: 80,
  labelHeight: 18,
  hGap: 24,
  vGap: 56,
}

export interface PlacedNode {
  id: string
  parentId: string | null
  label: string
  sidc: string
  /** top-left of the node's cell */
  x: number
  y: number
  width: number
  height: number
  depth: number
}

/** An orthogonal connector, as a polyline of points. */
export interface Connector {
  from: string
  to: string
  points: { x: number; y: number }[]
}

export interface OrbatLayout {
  nodes: PlacedNode[]
  connectors: Connector[]
  width: number
  height: number
}

/**
 * Tidy top-down tree layout: each leaf takes one cell, each parent is centred
 * over the span of its children, and subtrees never overlap because sibling
 * spans are laid end to end.
 */
export function layoutOrbat(roots: OrbatNode[], metrics: LayoutMetrics = DEFAULT_METRICS): OrbatLayout {
  const { cellWidth, cellHeight, labelHeight, hGap, vGap } = metrics
  const rowHeight = cellHeight + labelHeight
  const nodes: PlacedNode[] = []
  const connectors: Connector[] = []
  const centres = new Map<string, number>()

  /** Place a subtree with its left edge at `left`; returns the subtree width. */
  function place(node: OrbatNode, left: number): number {
    const y = node.depth * (rowHeight + vGap)
    if (node.children.length === 0) {
      const centre = left + cellWidth / 2
      centres.set(node.id, centre)
      nodes.push({
        id: node.id, parentId: node.parentId, label: node.label, sidc: node.sidc,
        x: left, y, width: cellWidth, height: rowHeight, depth: node.depth,
      })
      return cellWidth
    }

    let cursor = left
    for (let i = 0; i < node.children.length; i++) {
      if (i > 0) cursor += hGap
      cursor += place(node.children[i], cursor)
    }
    const span = cursor - left
    const firstCentre = centres.get(node.children[0].id)!
    const lastCentre = centres.get(node.children[node.children.length - 1].id)!
    const centre = (firstCentre + lastCentre) / 2
    centres.set(node.id, centre)
    nodes.push({
      id: node.id, parentId: node.parentId, label: node.label, sidc: node.sidc,
      x: centre - cellWidth / 2, y, width: cellWidth, height: rowHeight, depth: node.depth,
    })
    // A parent narrower than its children can sit left of the subtree origin;
    // the caller normalises any negative coordinates afterwards.
    return Math.max(span, cellWidth)
  }

  let cursor = 0
  for (let i = 0; i < roots.length; i++) {
    if (i > 0) cursor += hGap * 2
    cursor += place(roots[i], cursor)
  }

  // Normalise so the whole drawing starts at (0, 0).
  const minX = nodes.length ? Math.min(...nodes.map(n => n.x)) : 0
  if (minX !== 0) {
    for (const n of nodes) n.x -= minX
    for (const [k, v] of centres) centres.set(k, v - minX)
  }

  const byId = new Map(nodes.map(n => [n.id, n]))
  for (const n of nodes) {
    if (!n.parentId) continue
    const parent = byId.get(n.parentId)
    if (!parent) continue
    // Down from the parent's bottom edge, across at the midpoint, then down
    // into the child's top edge: the shape every ORBAT chart uses.
    const startY = parent.y + parent.height
    const endY = n.y
    const midY = startY + (endY - startY) / 2
    const px = parent.x + parent.width / 2
    const cx = n.x + n.width / 2
    connectors.push({
      from: parent.id,
      to: n.id,
      points:
        Math.abs(px - cx) < 0.01
          ? [{ x: px, y: startY }, { x: cx, y: endY }]
          : [
              { x: px, y: startY },
              { x: px, y: midY },
              { x: cx, y: midY },
              { x: cx, y: endY },
            ],
    })
  }

  const width = nodes.length ? Math.max(...nodes.map(n => n.x + n.width)) : 0
  const height = nodes.length ? Math.max(...nodes.map(n => n.y + n.height)) : 0
  return { nodes, connectors, width, height }
}

/** Flatten a forest into document order, parents before children. */
export function flatten(roots: OrbatNode[]): OrbatNode[] {
  const out: OrbatNode[] = []
  const walk = (n: OrbatNode) => {
    out.push(n)
    n.children.forEach(walk)
  }
  roots.forEach(walk)
  return out
}

export const EXAMPLE_ORBAT = `1st Armoured Brigade | bde | hq
  1-7 Infantry | bn | 121100
    A Company | company
    B Company | company
    C Company | company
  2-5 Armour | bn | 120500
    A Troop | troop
    B Troop | troop
  1-9 Field Artillery | bn | 130300
  16 Engineer Squadron | sqn | 140700
  Brigade Support Battalion | bn | 161300`
