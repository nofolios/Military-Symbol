import type { InsertOptions, SymbolSpec, SymbolStyle } from '../shared/messages'
import { EMPTY_SIDC, amplifierAppliesTo, formatSidc, parseSidc, type Sidc } from '../core/sidc'
import { getEntity, getModifier, getSet, entityLabel } from '../core/catalog'
import { DEFAULT_STYLE } from './render'

export type TabId = 'build' | 'browse' | 'batch' | 'orbat' | 'selection' | 'settings'

export interface AppState {
  tab: TabId
  sidc: Sidc
  amplifiers: Record<string, string>
  style: SymbolStyle
  insert: InsertOptions
  /** SIDC strings the user starred */
  favourites: string[]
  /** most recently inserted SIDC strings, newest first */
  recents: string[]
}

export const DEFAULT_INSERT: InsertOptions = {
  layout: 'grid',
  targetHeight: 0,
  columns: 6,
  gap: 24,
  asComponents: false,
  wrapInFrame: false,
  frameName: 'APP-6E symbols',
  captions: false,
}

export const initialState = (): AppState => ({
  tab: 'build',
  // A friendly land infantry platoon: a recognisable starting point.
  sidc: { ...EMPTY_SIDC, symbolSet: '10', entity: '121100', amplifier: '14' },
  amplifiers: {},
  style: { ...DEFAULT_STYLE },
  insert: { ...DEFAULT_INSERT },
  favourites: [],
  recents: [],
})

/** Human label for a SIDC, e.g. "Infantry · Friend · Platoon". */
export function describeSidc(s: Sidc): string {
  const set = getSet(s.symbolSet)
  const entity = getEntity(s.symbolSet, s.entity)
  const parts: string[] = []
  parts.push(entity ? entity.n : set ? set.name : `Set ${s.symbolSet}`)

  const m1 = getModifier(s.symbolSet, 1, s.modifier1)
  const m2 = getModifier(s.symbolSet, 2, s.modifier2)
  if (m1 && s.modifier1 !== '000') parts.push(m1.n)
  if (m2 && s.modifier2 !== '000') parts.push(m2.n)

  return parts.join(' · ')
}

/** Longer label used for Figma layer names. */
export function layerName(s: Sidc): string {
  const entity = getEntity(s.symbolSet, s.entity)
  const set = getSet(s.symbolSet)
  const name = entity ? entityLabel(entity).split(' / ').slice(-2).join(' ') : (set?.name ?? 'Symbol')
  return `APP-6E · ${name}`
}

export function buildSpec(state: AppState, sidc: Sidc = state.sidc, label?: string): SymbolSpec {
  return {
    sidc: formatSidc(sidc),
    amplifiers: { ...state.amplifiers },
    style: { ...state.style },
    label: label ?? layerName(sidc),
  }
}

export function specFrom(sidcString: string, state: AppState, label?: string): SymbolSpec {
  const parsed = parseSidc(sidcString)
  return {
    sidc: formatSidc(parsed),
    amplifiers: {},
    style: { ...state.style },
    label: label ?? layerName(parsed),
  }
}

/**
 * Move a list of picked SIDCs onto a new base.
 *
 * The Browse sheet stores whole 30-digit codes, but it rebuilds every cell from
 * the builder's current identity, so a change of affiliation (or of the "match
 * builder" toggle) would otherwise orphan every stored code: highlighted
 * nowhere, still counted, and inserted with the identity the user just left
 * behind. Only the symbol set and the entity survive from the stored code;
 * everything else comes from the base. Duplicates collapse.
 */
export function rebaseSelection(codes: readonly string[], base: Sidc): string[] {
  const out: string[] = []
  for (const code of codes) {
    const stored = parseSidc(code)
    const moved = formatSidc({ ...base, symbolSet: stored.symbolSet, entity: stored.entity })
    if (out.indexOf(moved) < 0) out.push(moved)
  }
  return out
}

/**
 * The SIDC that results from choosing a different symbol set.
 *
 * Entity and sector modifiers are numbered per symbol set, so carrying them
 * across would silently mean something else. The echelon/mobility amplifier is
 * kept only where APP-6E says it applies to the new set: without that check a
 * land unit's company bar follows the user onto a ship or an aircraft, which
 * the renderer draws quite happily.
 */
export function changeSymbolSet(sidc: Sidc, symbolSet: string): Sidc {
  return {
    ...sidc,
    symbolSet,
    entity: '000000',
    modifier1: '000',
    modifier2: '000',
    amplifier: amplifierAppliesTo(sidc.amplifier, symbolSet) ? sidc.amplifier : '00',
  }
}

export const MAX_RECENTS = 40

export function pushRecent(recents: string[], sidc: string): string[] {
  return [sidc, ...recents.filter(r => r !== sidc)].slice(0, MAX_RECENTS)
}
