/**
 * Validation for preferences read back from `figma.clientStorage`.
 *
 * What comes back is whatever was last written: possibly by an older version of
 * this plugin, possibly from another machine, possibly half-finished. Anything
 * that would reach milsymbol or Figma is checked against the defaults rather
 * than trusted, because one bad colour mode or a zero symbol size breaks every
 * render with no obvious cause.
 */
import type { InsertOptions, SymbolStyle } from '../shared/messages'

const COLOR_MODE_NAMES = new Set(['Light', 'Medium', 'Dark', 'FrameColor', 'Black', 'White', 'mono'])
const LAYOUT_NAMES = new Set(['viewport', 'grid', 'row', 'selection'])

export function sanitiseStyle(stored: unknown, base: SymbolStyle): SymbolStyle {
  if (!stored || typeof stored !== 'object') return base
  const raw = stored as Record<string, unknown>
  const num = (key: keyof SymbolStyle, min: number, max: number) => {
    const v = raw[key as string]
    return typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : base[key] as number
  }
  const bool = (key: keyof SymbolStyle) =>
    typeof raw[key as string] === 'boolean' ? (raw[key as string] as boolean) : (base[key] as boolean)
  const colorMode = COLOR_MODE_NAMES.has(String(raw.colorMode)) ? (raw.colorMode as SymbolStyle['colorMode']) : base.colorMode
  const colour = (key: 'monoColor' | 'outlineColor') =>
    typeof raw[key] === 'string' && /^#?[0-9a-fA-F]{3,8}$/.test(String(raw[key])) ? (raw[key] as string) : base[key]
  return {
    ...base,
    size: num('size', 8, 200),
    strokeWidth: num('strokeWidth', 1, 12),
    outlineWidth: num('outlineWidth', 0, 20),
    padding: num('padding', 0, 200),
    infoSize: num('infoSize', 1, 100),
    frame: bool('frame'),
    fill: bool('fill'),
    icon: bool('icon'),
    infoFields: bool('infoFields'),
    civilianColor: bool('civilianColor'),
    simpleStatusModifier: bool('simpleStatusModifier'),
    outlineText: bool('outlineText'),
    square: bool('square'),
    colorMode,
    monoColor: colour('monoColor'),
    outlineColor: colour('outlineColor'),
    standard: raw.standard === '2525' ? '2525' : 'APP6',
  }
}

export function sanitiseInsert(stored: unknown, base: InsertOptions): InsertOptions {
  if (!stored || typeof stored !== 'object') return base
  const raw = stored as Record<string, unknown>
  const num = (key: keyof InsertOptions, min: number, max: number) => {
    const v = raw[key as string]
    return typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : base[key] as number
  }
  const bool = (key: keyof InsertOptions) =>
    typeof raw[key as string] === 'boolean' ? (raw[key as string] as boolean) : (base[key] as boolean)
  return {
    ...base,
    layout: LAYOUT_NAMES.has(String(raw.layout)) ? (raw.layout as InsertOptions['layout']) : base.layout,
    targetHeight: num('targetHeight', 0, 4000),
    columns: num('columns', 1, 40),
    gap: num('gap', 0, 400),
    asComponents: bool('asComponents'),
    wrapInFrame: bool('wrapInFrame'),
    captions: bool('captions'),
    frameName: typeof raw.frameName === 'string' ? raw.frameName.slice(0, 120) : base.frameName,
  }
}

export const sanitiseCodes = (stored: unknown, limit: number): string[] =>
  Array.isArray(stored)
    ? stored.filter(v => typeof v === 'string' && /^[0-9A]{10,30}$/.test(v)).slice(0, limit)
    : []
