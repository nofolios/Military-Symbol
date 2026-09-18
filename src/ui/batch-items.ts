/**
 * The Batch pane's list logic, kept out of the component so it can be tested
 * without a DOM: what a pasted list parses to, which echelons a symbol set
 * carries, and which generated codes are fit to insert.
 */
import { amplifiersForSet, cleanSidcInput, formatSidc, parseSidc, validateSidc } from '../core/sidc'
import { symbolSetCodes } from '../core/catalog'
import { canDraw } from './render'
import { layerName } from './store'

export interface BatchItem {
  sidc: string
  label: string
  /** set when the code must not be inserted; shown against the thumbnail */
  problem?: string
}

/**
 * Codes APP-6E has no point symbol for are rejected rather than warned about:
 * every one of them would insert the renderer's question-mark glyph, which is
 * never the drawing the user asked for. The message is a constant so the pane
 * can tell this apart from a structurally broken code and count it separately.
 */
export const NO_POINT_SYMBOL = 'APP-6E defines no point symbol for this code'

/** The echelons APP-6E allows on one symbol set; a ship or an aircraft has none. */
export function echelonLadder(symbolSet: string): string[] {
  return amplifiersForSet(symbolSet).filter(a => a.group === 'Echelon').map(a => a.code)
}

/**
 * Flag every item that must not reach the sandbox.
 *
 * Two independent things can be wrong. A pasted list can carry codes the UI's
 * own controls could never produce - milsymbol's `isValid()` accepts standard
 * identities 7 to 9 and then draws nothing at all - and a perfectly formed code
 * can still have no point symbol, which is true of most of symbol set 25. Bad
 * entries stay in the list so the user can see which line was wrong; they are
 * simply never handed over.
 */
export function checkBatchItems(items: readonly BatchItem[], standard: 'APP6' | '2525'): BatchItem[] {
  return items.map(item => {
    const problems = validateSidc(parseSidc(item.sidc), symbolSetCodes).filter(p => p.severity === 'error')
    if (problems.length) return { ...item, problem: problems.map(p => p.message).join('; ') }
    if (!canDraw(item.sidc, standard)) return { ...item, problem: NO_POINT_SYMBOL }
    return item
  })
}

/** Accepts "sidc", "sidc, label", "sidc<tab>label" and "sidc | label". */
export function parsePasted(text: string): BatchItem[] {
  const out: BatchItem[] = []
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const parts = trimmed.split(/\s*[,\t|]\s*/)
    const raw = cleanSidcInput(parts[0])
    if (raw.length < 10) continue
    const parsed = parseSidc(raw)
    out.push({ sidc: formatSidc(parsed), label: parts.slice(1).join(' ').trim() || layerName(parsed) })
  }
  return out
}
