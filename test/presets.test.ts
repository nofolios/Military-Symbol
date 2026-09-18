import { test } from 'node:test'
import assert from 'node:assert/strict'
import ms from 'milsymbol'
import { PRESETS, PRESET_CATEGORIES, searchPresets } from '../src/data/presets'
import { hasIconGeometry, renderingSidc } from '../src/ui/render'
import { SIDC_LENGTH, parseSidc, validateSidc } from '../src/core/sidc'
import { symbolSetCodes } from '../src/core/catalog'

/**
 * The first characters of milsymbol's "undefined icon" question-mark path. If
 * it turns up in a preset's output the entity code has no icon and the user
 * would be handed a question mark.
 */
const UNDEFINED_ICON = 'm 94.8206,78.1372'

// Presets are an APP-6 library; the glyph set comes from the render option,
// never from the SIDC, so the standard has to be set before anything renders.
ms.setStandard('APP6')

const symbolOf = (sidc: string) =>
  new ms.Symbol(renderingSidc(sidc), { size: 40, standard: 'APP6' })

test('every preset SIDC is 30 digits and APP-6E versioned', () => {
  for (const p of PRESETS) {
    assert.equal(p.sidc.length, SIDC_LENGTH, `${p.label}: ${p.sidc}`)
    assert.match(p.sidc, /^\d{30}$/, `${p.label}: ${p.sidc}`)
    assert.equal(p.sidc.slice(0, 2), '14', `${p.label} is not version 14 (APP-6E)`)
  }
})

test('every preset is structurally valid and in a known symbol set', () => {
  for (const p of PRESETS) {
    const problems = validateSidc(parseSidc(p.sidc), symbolSetCodes)
    assert.deepEqual(problems, [], `${p.label} (${p.sidc})`)
  }
})

test('every preset renders: isValid, real icon geometry, no undefined icon', () => {
  const failures: string[] = []
  for (const p of PRESETS) {
    const sym = symbolOf(p.sidc)
    const svg = sym.asSVG()
    if (sym.isValid() !== true) failures.push(`${p.label} (${p.sidc}): isValid() is false`)
    if (!hasIconGeometry(p.sidc)) failures.push(`${p.label} (${p.sidc}): draws nothing beyond the frame`)
    if (svg.includes(UNDEFINED_ICON)) failures.push(`${p.label} (${p.sidc}): renders the undefined-icon question mark`)
    if (!svg.startsWith('<svg')) failures.push(`${p.label} (${p.sidc}): produced no SVG`)
  }
  assert.deepEqual(failures, [], `${failures.length}/${PRESETS.length} presets failed:\n${failures.join('\n')}`)
})

test('the library is large enough and every preset is unique', () => {
  assert.ok(PRESETS.length >= 90, `expected at least 90 presets, got ${PRESETS.length}`)
  const sidcs = PRESETS.map(p => p.sidc)
  const seen = new Map<string, string>()
  for (const p of PRESETS) {
    const previous = seen.get(p.sidc)
    assert.equal(previous, undefined, `duplicate SIDC ${p.sidc}: "${previous}" and "${p.label}"`)
    seen.set(p.sidc, p.label)
  }
  assert.equal(new Set(sidcs).size, sidcs.length)
  const labels = PRESETS.map(p => p.label)
  assert.equal(new Set(labels).size, labels.length, 'preset labels must be unique')
})

test('labels and categories are non-empty and listed in PRESET_CATEGORIES', () => {
  for (const p of PRESETS) {
    assert.ok(p.label.trim().length > 0, `${p.sidc} has an empty label`)
    assert.ok(p.category.trim().length > 0, `${p.label} has an empty category`)
    assert.ok(PRESET_CATEGORIES.includes(p.category), `${p.category} missing from PRESET_CATEGORIES`)
    if (p.keywords !== undefined) assert.ok(p.keywords.trim().length > 0, `${p.label} has empty keywords`)
  }
  assert.ok(PRESET_CATEGORIES.length >= 8, `expected at least 8 categories, got ${PRESET_CATEGORIES.length}`)
  assert.equal(new Set(PRESET_CATEGORIES).size, PRESET_CATEGORIES.length, 'duplicate category')
  for (const c of PRESET_CATEGORIES) {
    assert.ok(PRESETS.some(p => p.category === c), `${c} has no presets`)
  }
})

test('every symbol set that has icons is represented', () => {
  const covered = new Set(PRESETS.map(p => p.sidc.slice(4, 6)))
  const expected = ['01', '02', '05', '06', '10', '11', '15', '20', '25', '27', '30', '35', '36', '40', '50', '51', '52', '53', '54', '60']
  for (const set of expected) assert.ok(covered.has(set), `symbol set ${set} has no preset`)
})

test('a realistic spread of affiliations and echelons is covered', () => {
  const affiliations = new Set(PRESETS.map(p => p.sidc.slice(3, 4)))
  for (const si of ['1', '3', '4', '6']) {
    assert.ok(affiliations.has(si), `no preset with standard identity ${si}`)
  }
  const echelons = new Set(PRESETS.map(p => p.sidc.slice(8, 10)))
  for (const amp of ['11', '14', '15', '16', '18']) {
    assert.ok(echelons.has(amp), `no preset with amplifier ${amp}`)
  }
})

test('searchPresets matches labels, categories and keywords, case-insensitively', () => {
  assert.deepEqual(searchPresets(''), PRESETS)
  assert.deepEqual(searchPresets('   '), PRESETS)
  assert.equal(searchPresets('zzzznotasymbol').length, 0)

  const tanks = searchPresets('TANK')
  assert.ok(tanks.length > 0)
  assert.ok(tanks.every(p => `${p.label} ${p.category} ${p.keywords ?? ''}`.toLowerCase().includes('tank')))

  // Category-only and keyword-only hits both count.
  assert.ok(searchPresets('sustainment').length > 0)
  assert.ok(searchPresets('medevac').some(p => p.label.includes('MEDEVAC')))

  // All tokens must match, so adding one can only narrow the result.
  const wide = searchPresets('infantry')
  const narrow = searchPresets('infantry company')
  assert.ok(narrow.length > 0)
  assert.ok(narrow.length < wide.length)
})

test('searchPresets ranks a label prefix match first', () => {
  const hits = searchPresets('medical')
  assert.ok(hits.length > 1)
  assert.ok(hits[0].label.toLowerCase().startsWith('medical'), `got "${hits[0].label}" first`)

  const sniper = searchPresets('sniper')
  assert.equal(sniper[0].label, 'Sniper', `got "${sniper[0].label}" first`)
})
