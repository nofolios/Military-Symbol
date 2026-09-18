/**
 * The panes' own logic, with the components left out of it: which generated
 * codes are fit to insert, and what happens to a sheet of picked symbols when
 * the identity under them changes.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  NO_POINT_SYMBOL, checkBatchItems, echelonLadder, parsePasted,
} from '../src/ui/batch-items'
import { changeSymbolSet, rebaseSelection } from '../src/ui/store'
import {
  AMPLIFIERS, EMPTY_SIDC, amplifierAppliesTo, formatSidc, parseSidc, type Sidc,
} from '../src/core/sidc'
import { searchEntities, symbolSets } from '../src/core/catalog'

const sidcOf = (patch: Partial<Sidc>) => formatSidc({ ...EMPTY_SIDC, ...patch })

const INFANTRY = sidcOf({ symbolSet: '10', entity: '121100' })
/** Free Fire Area: a perfectly formed code with no point symbol at all. */
const FREE_FIRE_AREA = sidcOf({ symbolSet: '25', entity: '240200' })

/* ------------------------------------------------------------ batch items */

test('a code with no point symbol is rejected, not quietly inserted', () => {
  const checked = checkBatchItems(
    [
      { sidc: INFANTRY, label: 'Infantry' },
      { sidc: FREE_FIRE_AREA, label: 'Free Fire Area' },
    ],
    'APP6'
  )
  assert.equal(checked[0].problem, undefined, 'infantry must stay usable')
  assert.equal(checked[1].problem, NO_POINT_SYMBOL, 'the free fire area must be held back')
  assert.deepEqual(checked.filter(i => !i.problem).map(i => i.sidc), [INFANTRY])
})

test('a whole Control Measure sheet is mostly rejected, and says which kind of wrong', () => {
  const items = searchEntities('', { setCode: '25', limit: 4000 }).map(h => ({
    sidc: sidcOf({ symbolSet: '25', entity: h.entity.c }),
    label: h.entity.n,
  }))
  assert.ok(items.length > 500, `expected the whole set, got ${items.length}`)
  const checked = checkBatchItems(items, 'APP6')
  const undrawable = checked.filter(i => i.problem === NO_POINT_SYMBOL)
  const malformed = checked.filter(i => i.problem && i.problem !== NO_POINT_SYMBOL)
  const usable = checked.filter(i => !i.problem)

  assert.equal(malformed.length, 0, 'these codes are structurally fine; that was never the problem')
  assert.ok(undrawable.length > 300, `expected the line and area measures caught, got ${undrawable.length}`)
  assert.ok(usable.length > 100, 'the real point control measures must still come through')
  assert.equal(usable.length + undrawable.length, checked.length)
})

test('a structurally broken code is rejected for its own reason', () => {
  // Standard identity 7 is outside the enumeration; milsymbol accepts it and
  // then draws nothing.
  const broken = '14073000121100000000'.padEnd(30, '0')
  const [checked] = checkBatchItems([{ sidc: broken, label: 'Nonsense' }], 'APP6')
  assert.ok(checked.problem, 'a code outside the enumerations must be rejected')
  assert.notEqual(checked.problem, NO_POINT_SYMBOL, 'and not mislabelled as a missing symbol')
})

test('the echelon ladder only offers echelons the symbol set actually carries', () => {
  assert.ok(echelonLadder('10').includes('15'), 'a land unit ladder includes Company')
  assert.deepEqual(echelonLadder('30'), [], 'a ship carries no echelon')
  assert.deepEqual(echelonLadder('01'), [], 'nor does an aircraft')
  assert.ok(!echelonLadder('27').includes('21'), 'a dismounted individual is not a division')
})

test('parsePasted takes a code with a label after a comma, tab or pipe', () => {
  const items = parsePasted(
    [
      '# a comment',
      '',
      `${INFANTRY}, Infantry`,
      `${INFANTRY}\tTabbed`,
      `${INFANTRY} | Piped`,
      'not-a-sidc',
    ].join('\n')
  )
  assert.deepEqual(items.map(i => i.label), ['Infantry', 'Tabbed', 'Piped'])
  for (const i of items) assert.equal(i.sidc, INFANTRY)
})

/* ------------------------------------------------- browse sheet selections */

test('picked symbols follow the affiliation instead of going invisible', () => {
  const friendly: Sidc = { ...EMPTY_SIDC, symbolSet: '10', standardIdentity: '3' }
  const picked = [
    formatSidc({ ...friendly, entity: '121100' }),
    formatSidc({ ...friendly, entity: '110500' }),
  ]
  const hostile: Sidc = { ...friendly, standardIdentity: '6' }

  const moved = rebaseSelection(picked, hostile)
  assert.equal(moved.length, 2, 'nothing may be lost in the move')
  for (const code of moved) {
    assert.equal(parseSidc(code).standardIdentity, '6', 'the selection must carry the new affiliation')
  }
  // The entities are exactly the ones that were picked, so every stored code
  // still matches a cell on the sheet.
  assert.deepEqual(moved.map(c => parseSidc(c).entity), ['121100', '110500'])
  // And these are precisely the codes the sheet now renders.
  assert.deepEqual(moved, picked.map(c => formatSidc({ ...hostile, entity: parseSidc(c).entity })))
})

test('rebasing keeps each pick in its own symbol set, and collapses duplicates', () => {
  const base: Sidc = { ...EMPTY_SIDC, symbolSet: '10', amplifier: '00' }
  const picked = [
    formatSidc({ ...base, symbolSet: '10', entity: '121100' }),
    formatSidc({ ...base, symbolSet: '15', entity: '120200' }),
    // The same entity twice, differing only in what the rebase overwrites.
    formatSidc({ ...base, symbolSet: '10', entity: '121100', status: '2' }),
  ]
  const moved = rebaseSelection(picked, { ...base, standardIdentity: '4' })
  assert.equal(moved.length, 2, 'the two forms of the same pick must collapse into one')
  assert.deepEqual(moved.map(c => parseSidc(c).symbolSet), ['10', '15'])
})

test('rebasing onto an unchanged base leaves the list byte for byte alone', () => {
  const base: Sidc = { ...EMPTY_SIDC, symbolSet: '10' }
  const picked = ['121100', '110500'].map(entity => formatSidc({ ...base, entity }))
  assert.deepEqual(rebaseSelection(picked, base), picked)
})

test('a builder echelon reaches the sheet only while "match builder" is on', () => {
  // The finding's second path: flipping the toggle under a live selection used
  // to leave it invisible and insert without the echelon.
  const matching: Sidc = { ...EMPTY_SIDC, symbolSet: '10', amplifier: '16' }
  const plain: Sidc = { ...matching, amplifier: '00' }
  const picked = [formatSidc({ ...matching, entity: '121100' })]

  assert.equal(parseSidc(rebaseSelection(picked, plain)[0]).amplifier, '00')
  assert.equal(parseSidc(rebaseSelection(picked, matching)[0]).amplifier, '16')
})

/* ------------------------------------------------- changing the symbol set */

test('changing symbol set drops an echelon the new set cannot carry', () => {
  // A land infantry company, switched to Sea Surface. Echelons are a land-unit
  // amplifier; milsymbol will happily draw a company bar on a frigate, so the
  // transition has to clear it.
  const company = { ...EMPTY_SIDC, symbolSet: '10', entity: '121100', amplifier: '15' }
  const atSea = changeSymbolSet(company, '30')
  assert.equal(atSea.symbolSet, '30')
  assert.equal(atSea.amplifier, '00', 'a company bar must not follow the user onto a ship')
  assert.equal(atSea.entity, '000000', 'entity codes are numbered per symbol set')
  assert.equal(atSea.modifier1, '000')
  assert.equal(atSea.modifier2, '000')
})

test('changing symbol set keeps an amplifier the new set does share', () => {
  const tracked = { ...EMPTY_SIDC, symbolSet: '15', entity: '120202', amplifier: '33' }
  const moved = changeSymbolSet(tracked, '27')
  assert.equal(
    moved.amplifier,
    amplifierAppliesTo('33', '27') ? '33' : '00',
    'the transition must agree with the applicability table, not guess'
  )
  // And the same amplifier really is legal on both, so it survives.
  if (amplifierAppliesTo('33', '15') && amplifierAppliesTo('33', '27')) {
    assert.equal(moved.amplifier, '33', 'a mobility indicator both sets allow should survive')
  }
})

test('no symbol set ends up carrying an amplifier it does not allow', () => {
  // Sweep every set-to-set transition for every amplifier.
  const offenders: string[] = []
  for (const from of symbolSets) {
    for (const amp of AMPLIFIERS) {
      if (!amplifierAppliesTo(amp.code, from.code)) continue
      const start = { ...EMPTY_SIDC, symbolSet: from.code, amplifier: amp.code }
      for (const to of symbolSets) {
        const next = changeSymbolSet(start, to.code)
        if (!amplifierAppliesTo(next.amplifier, to.code)) {
          offenders.push(`${from.code}/${amp.code} -> ${to.code} kept ${next.amplifier}`)
        }
      }
    }
  }
  assert.deepEqual(offenders.slice(0, 10), [], `${offenders.length} illegal carry-overs`)
})

test('the transition is a no-op when the set does not actually change', () => {
  const start = { ...EMPTY_SIDC, symbolSet: '10', entity: '121100', amplifier: '15' }
  const same = changeSymbolSet(start, '10')
  assert.equal(same.amplifier, '15', 're-picking the same set should not clear the echelon')
  // The entity is still reset, because the control is a symbol-set picker and
  // the user is about to choose a new entity from it either way.
  assert.equal(same.entity, '000000')
})
