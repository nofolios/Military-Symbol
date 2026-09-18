import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  AMPLIFIERS, APP6E_VERSION, CONTEXTS, EMPTY_SIDC, FRAME_SHAPES, HQTFD,
  SIDC_LENGTH, STANDARD_IDENTITIES, STATUSES,
  amplifierAppliesTo, amplifiersForSet,
  formatSidc, frameFamily, isDashedFrame, isFeintOrDummy, isHeadquarters, isTaskForce,
  parseSidc, validateSidc,
} from '../src/core/sidc'

test('formatSidc always emits exactly 30 digits', () => {
  assert.equal(formatSidc(EMPTY_SIDC).length, SIDC_LENGTH)
  assert.match(formatSidc(EMPTY_SIDC), /^\d{30}$/)
})

test('parse and format round-trip', () => {
  const samples = [
    '140310001211000000000000000000',
    '130315003611010300000000000000',
    '100310001412110000000000000000',
    '140325000110000000000000000000',
  ]
  for (const s of samples) {
    assert.equal(formatSidc(parseSidc(s)), s, `round-trip failed for ${s}`)
  }
})

test('sector modifier digits land in the E-edition positions', () => {
  // modifier1 "123" => digits 17-18 are "23" and digit 21 is "1".
  const s = { ...EMPTY_SIDC, modifier1: '123', modifier2: '456' }
  const str = formatSidc(s)
  assert.equal(str.slice(16, 18), '23', 'sector 1 low digits')
  assert.equal(str.slice(18, 20), '56', 'sector 2 low digits')
  assert.equal(str.slice(20, 21), '1', 'sector 1 high digit')
  assert.equal(str.slice(21, 22), '4', 'sector 2 high digit')
  const back = parseSidc(str)
  assert.equal(back.modifier1, '123')
  assert.equal(back.modifier2, '456')
})

test('every field lands at its documented position', () => {
  const s = {
    version: '14', context: '1', standardIdentity: '6', symbolSet: '35',
    status: '2', hqtfd: '4', amplifier: '21', entity: '112233',
    modifier1: '000', modifier2: '000', frameShape: '7', reserved: '0000000',
  }
  const str = formatSidc(s)
  assert.equal(str.slice(0, 2), '14')
  assert.equal(str.slice(2, 3), '1')
  assert.equal(str.slice(3, 4), '6')
  assert.equal(str.slice(4, 6), '35')
  assert.equal(str.slice(6, 7), '2')
  assert.equal(str.slice(7, 8), '4')
  assert.equal(str.slice(8, 10), '21')
  assert.equal(str.slice(10, 16), '112233')
  assert.equal(str.slice(22, 23), '7')
})

test('parseSidc tolerates 20-digit D-edition codes and separators', () => {
  const d20 = '10031000141211000000'
  const parsed = parseSidc(d20)
  assert.equal(parsed.symbolSet, '10')
  assert.equal(parsed.amplifier, '14', 'platoon')
  assert.equal(parsed.entity, '121100', 'infantry')
  assert.equal(formatSidc(parsed).length, 30)
  assert.deepEqual(parseSidc('1003-1000 1412 1100 0000'), parsed)
})

test('validateSidc flags out-of-range fields', () => {
  const bad = { ...EMPTY_SIDC, context: '9', standardIdentity: '8', status: '7', hqtfd: '9' }
  const problems = validateSidc(bad)
  const fields = problems.filter(p => p.severity === 'error').map(p => p.field)
  assert.deepEqual(new Set(fields), new Set(['context', 'standardIdentity', 'status', 'hqtfd']))
  assert.equal(validateSidc(EMPTY_SIDC).length, 0)
})

test('enumerations have unique codes', () => {
  for (const [name, list] of Object.entries({ CONTEXTS, STANDARD_IDENTITIES, STATUSES, HQTFD, AMPLIFIERS, FRAME_SHAPES })) {
    const codes = (list as ReadonlyArray<{ code: string }>).map(x => x.code)
    assert.equal(new Set(codes).size, codes.length, `${name} has duplicate codes`)
  }
})

test('joker and faker render on a friendly frame', () => {
  const joker = { ...EMPTY_SIDC, context: '1', standardIdentity: '5' }
  const faker = { ...EMPTY_SIDC, context: '1', standardIdentity: '6' }
  assert.equal(frameFamily(joker), 'Friend')
  assert.equal(frameFamily(faker), 'Friend')
  assert.equal(frameFamily({ ...EMPTY_SIDC, context: '0', standardIdentity: '6' }), 'Hostile')
})

test('dashed frames follow pending, assumed, suspect and planned', () => {
  assert.equal(isDashedFrame({ ...EMPTY_SIDC, standardIdentity: '0' }), true, 'pending')
  assert.equal(isDashedFrame({ ...EMPTY_SIDC, standardIdentity: '2' }), true, 'assumed friend')
  assert.equal(isDashedFrame({ ...EMPTY_SIDC, standardIdentity: '5' }), true, 'suspect')
  assert.equal(isDashedFrame({ ...EMPTY_SIDC, standardIdentity: '3', status: '1' }), true, 'planned')
  assert.equal(isDashedFrame({ ...EMPTY_SIDC, standardIdentity: '3' }), false, 'plain friend')
})

test('feint and dummy leave the frame solid and add a chevron instead', () => {
  // milsymbol draws hqtfd=1 with a solid frame plus a dashed inverted-V.
  for (const code of ['1', '3', '5', '7']) {
    assert.equal(isFeintOrDummy({ ...EMPTY_SIDC, hqtfd: code }), true, `hqtfd ${code}`)
    assert.equal(isDashedFrame({ ...EMPTY_SIDC, standardIdentity: '3', hqtfd: code }), false, `hqtfd ${code}`)
  }
  assert.equal(isFeintOrDummy({ ...EMPTY_SIDC, hqtfd: '2' }), false)
})

test('the HQ/TF/dummy digit decomposes into its three flags', () => {
  const hq = ['2', '3', '6', '7']
  const tf = ['4', '5', '6', '7']
  for (let n = 0; n <= 7; n++) {
    const code = String(n)
    assert.equal(isHeadquarters({ ...EMPTY_SIDC, hqtfd: code }), hq.includes(code), `hq ${code}`)
    assert.equal(isTaskForce({ ...EMPTY_SIDC, hqtfd: code }), tf.includes(code), `tf ${code}`)
  }
})

test('the default version targets APP-6E', () => {
  assert.equal(EMPTY_SIDC.version, APP6E_VERSION)
})

test('the frame-shape override survives a round-trip, including "A" for unframed', () => {
  for (const shape of FRAME_SHAPES.map(f => f.code)) {
    const round = parseSidc(formatSidc({ ...EMPTY_SIDC, frameShape: shape }))
    assert.equal(round.frameShape, shape, `frame shape ${shape}`)
  }
})

test('an unknown frame-shape character falls back to "from symbol set"', () => {
  assert.equal(parseSidc('1403100014121100000000Z0000000').frameShape, '0')
  assert.equal(formatSidc({ ...EMPTY_SIDC, frameShape: 'Z' }).slice(22, 23), '0')
})

test('parseSidc strips separators without eating the frame-shape letter', () => {
  const withSeparators = '1403-1000-1412-1100-0000-00A-000000'
  const parsed = parseSidc(withSeparators)
  assert.equal(parsed.frameShape, 'A')
  assert.equal(parsed.symbolSet, '10')
})

/* --------------------------------------------- amplifier applicability (§6.2) */

test('the amplifier list is scoped to the symbol set, per APP-6E §6.2', () => {
  const codes = (setCode: string) => amplifiersForSet(setCode).map(a => a.code)

  // Land units carry echelons, all the way up.
  assert.ok(codes('10').includes('15'), 'a land unit must offer Company')
  assert.ok(codes('10').includes('26'), 'a land unit must offer Command')
  // Ships, aircraft and equipment carry none of them.
  for (const set of ['01', '30', '15', '35', '60']) {
    const echelons = amplifiersForSet(set).filter(a => a.group === 'Echelon')
    assert.deepEqual(echelons, [], `symbol set ${set} must offer no echelon`)
  }
  // Mobility belongs to equipment, not to units.
  assert.ok(codes('15').includes('33'), 'land equipment must offer Tracked')
  assert.ok(!codes('10').includes('33'), 'a land unit must not offer Tracked')
  // Towed arrays are naval; leadership is the dismounted individual only.
  assert.deepEqual(codes('35').filter(c => c === '61' || c === '62'), ['61', '62'])
  assert.ok(!codes('10').includes('61'), 'a land unit must not offer a towed array')
  assert.ok(codes('27').includes('71') && codes('27').includes('72'))
  assert.ok(!codes('10').includes('71'), 'only a dismounted individual leads')
  // A dismounted individual is not a division.
  assert.ok(codes('27').includes('14'), 'brigade and below applies to set 27')
  assert.ok(!codes('27').includes('21'), 'division and above does not')
  // "None" is always available, and every set offers it.
  for (const set of ['01', '10', '25', '60']) {
    assert.equal(codes(set)[0], '00', `symbol set ${set} lost the empty amplifier`)
  }
})

test('every amplifier declares an applicability, and amplifierAppliesTo agrees with it', () => {
  for (const a of AMPLIFIERS) {
    assert.ok(a.sets === 'all' || a.sets.length > 0, `${a.code} declares no symbol set`)
  }
  assert.equal(amplifierAppliesTo('14', '10'), true)
  assert.equal(amplifierAppliesTo('14', '30'), false, 'a platoon bar has no business on a ship')
  assert.equal(amplifierAppliesTo('00', '30'), true)
  assert.equal(amplifierAppliesTo('99', '10'), false, 'an unknown code applies nowhere')
  for (const a of AMPLIFIERS) {
    for (const set of ['01', '10', '15', '25', '27', '30', '35', '52', '53', '54', '60']) {
      assert.equal(
        amplifierAppliesTo(a.code, set),
        amplifiersForSet(set).some(x => x.code === a.code),
        `${a.code} on set ${set}`
      )
    }
  }
})

test('the two leadership amplifiers disclose what milsymbol actually draws', () => {
  // milsymbol draws one chevron for both 71 and 72, and only on a friendly
  // frame (modifier.js:621-638). The picker must say so rather than offer two
  // choices that look distinct and are not.
  const leadership = AMPLIFIERS.filter(a => a.group === 'Leadership').map(a => a.label)
  assert.equal(leadership.length, 2)
  assert.match(leadership[0], /friend/i, 'Leader must disclose that it is friend-only')
  assert.match(leadership[1], /leader/i, 'Deputy must disclose that it draws as Leader')
})
