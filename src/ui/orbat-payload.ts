/**
 * Turns an ORBAT outline into everything the sandbox needs to draw it:
 * a rendered symbol per unit, a placement per cell, and one SVG holding
 * every connector.
 */
import type { OrbatPayload, OrbatPlacement, RenderedSymbol } from '../shared/messages'
import { parseSidc } from '../core/sidc'
import {
  DEFAULT_METRICS, layoutOrbat, parseOrbat,
  type LayoutMetrics, type OrbatProblem, type PlacedNode,
} from '../core/orbat'
import { render } from './render'
import { specFrom, type AppState } from './store'

export interface OrbatBuild {
  payload: OrbatPayload | null
  problems: OrbatProblem[]
  placed: PlacedNode[]
  count: number
  width: number
  height: number
  /** the connector SVG, also used for the in-panel preview */
  connectorSvg: string
  /** per-placement preview markup, parallel to `placed` */
  previews: string[]
  /** octagon anchor per placement, so the preview aligns frames the way Figma will */
  anchors: ({ x: number; y: number } | null)[]
}

const escapeXml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** All connectors as one SVG path, in chart coordinates. */
export function connectorSvg(
  connectors: { points: { x: number; y: number }[] }[],
  width: number,
  height: number,
  stroke: string,
  strokeWidth: number
): string {
  if (connectors.length === 0 || width <= 0 || height <= 0) return ''
  const d = connectors
    .map(c => c.points.map((p, i) => `${i === 0 ? 'M' : 'L'}${round(p.x)},${round(p.y)}`).join(' '))
    .join(' ')
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${round(width)}" height="${round(height)}" ` +
    `viewBox="0 0 ${round(width)} ${round(height)}">` +
    `<path d="${d}" fill="none" stroke="${escapeXml(stroke)}" stroke-width="${strokeWidth}" ` +
    `stroke-linecap="square" stroke-linejoin="miter"/></svg>`
  )
}

const round = (n: number) => Math.round(n * 100) / 100

export interface OrbatOptions {
  metrics?: Partial<LayoutMetrics>
  /**
   * milsymbol's own size, which is the frame height in px for a land unit.
   * ORBAT charts are read by comparing frames, so every symbol gets the same
   * `size` rather than the same total bounding height: an HQ staff or a
   * mobility bracket must grow the symbol, not shrink its frame.
   */
  symbolSize?: number
  connectorColor?: string
  connectorWidth?: number
  labelFontSize?: number
  name?: string
  /** skip rendering the symbols; used for a cheap structural preview */
  structureOnly?: boolean
}

export function buildOrbat(text: string, state: AppState, opts: OrbatOptions = {}): OrbatBuild {
  const metrics: LayoutMetrics = { ...DEFAULT_METRICS, ...(opts.metrics ?? {}) }
  const { roots, problems, count } = parseOrbat(text, state.sidc)
  const layout = layoutOrbat(roots, metrics)

  const symbolSize = Math.max(8, Math.round(opts.symbolSize ?? metrics.cellHeight * 0.5))

  const symbols: RenderedSymbol[] = []
  const placements: OrbatPlacement[] = []
  const previews: string[] = []
  const anchors: ({ x: number; y: number } | null)[] = []

  for (const node of layout.nodes) {
    const spec = specFrom(node.sidc, state, node.label)
    let rendered: RenderedSymbol | null = null
    if (!opts.structureOnly) {
      try {
        rendered = render({ ...spec, style: { ...spec.style, size: symbolSize, infoFields: false } })
      } catch {
        rendered = null
      }
    }
    const index = symbols.length
    if (rendered) symbols.push(rendered)
    previews.push(rendered ? rendered.svg : '')
    anchors.push(rendered ? rendered.anchor : null)
    placements.push({
      index: rendered ? index : -1,
      label: node.label,
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
      labelHeight: metrics.labelHeight,
    })
  }

  const svg = connectorSvg(
    layout.connectors,
    layout.width,
    layout.height,
    opts.connectorColor ?? '#333333',
    opts.connectorWidth ?? 1.5
  )

  const usable = placements.filter(p => p.index >= 0)
  const payload: OrbatPayload | null =
    usable.length === 0
      ? null
      : {
          name: opts.name || 'ORBAT',
          width: layout.width,
          height: layout.height,
          symbols,
          placements: usable,
          connectorSvg: svg,
          labelFontSize: opts.labelFontSize ?? 11,
        }

  return {
    payload,
    problems,
    placed: layout.nodes,
    count,
    width: layout.width,
    height: layout.height,
    connectorSvg: svg,
    previews,
    anchors,
  }
}

/** Human summary of a SIDC used in the ORBAT problem list. */
export const echelonOf = (sidc: string) => parseSidc(sidc).amplifier
