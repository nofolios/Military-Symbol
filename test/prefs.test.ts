import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sanitiseCodes, sanitiseInsert, sanitiseStyle } from '../src/ui/prefs'
import { DEFAULT_STYLE, render } from '../src/ui/render'
import { DEFAULT_INSERT } from '../src/ui/store'

test('a missing or malformed blob falls back to the defaults', () => {
  for (const junk of [null, undefined, 'a string', 42, []]) {
    assert.deepEqual(sanitiseStyle(junk, DEFAULT_STYLE), DEFAULT_STYLE)
    assert.deepEqual(sanitiseInsert(junk, DEFAULT_INSERT), DEFAULT_INSERT)
  }
})

test('a colour mode the renderer does not know is rejected', () => {
  const style = sanitiseStyle({ colorMode: 'Chartreuse' }, DEFAULT_STYLE)
  assert.equal(style.colorMode, DEFAULT_STYLE.colorMode)
  // The whole point: whatever comes back must still render.
  assert.doesNotThrow(() =>
    render({ sidc: '140310001512110000000000000000', amplifiers: {}, style, label: 'x' })
  )
})

test('a stored colour mode the renderer does know is kept', () => {
  assert.equal(sanitiseStyle({ colorMode: 'Dark' }, DEFAULT_STYLE).colorMode, 'Dark')
  assert.equal(sanitiseStyle({ colorMode: 'mono' }, DEFAULT_STYLE).colorMode, 'mono')
})

test('numbers are clamped into their usable range', () => {
  const tiny = sanitiseStyle({ size: 0, strokeWidth: -5, infoSize: 0 }, DEFAULT_STYLE)
  assert.ok(tiny.size >= 8, 'a zero size would make every insert fail')
  assert.ok(tiny.strokeWidth >= 1)
  assert.ok(tiny.infoSize >= 1)

  const huge = sanitiseStyle({ size: 1e9, outlineWidth: 1e9 }, DEFAULT_STYLE)
  assert.ok(huge.size <= 200)
  assert.ok(huge.outlineWidth <= 20)

  const nonsense = sanitiseStyle({ size: 'forty', strokeWidth: NaN }, DEFAULT_STYLE)
  assert.equal(nonsense.size, DEFAULT_STYLE.size)
  assert.equal(nonsense.strokeWidth, DEFAULT_STYLE.strokeWidth)
})

test('a colour that is not a colour is rejected', () => {
  assert.equal(sanitiseStyle({ monoColor: 'javascript:alert(1)' }, DEFAULT_STYLE).monoColor, DEFAULT_STYLE.monoColor)
  assert.equal(sanitiseStyle({ monoColor: '#1a2b3c' }, DEFAULT_STYLE).monoColor, '#1a2b3c')
})

test('the standard falls back to APP-6 rather than to US glyphs', () => {
  assert.equal(sanitiseStyle({ standard: 'nonsense' }, DEFAULT_STYLE).standard, 'APP6')
  assert.equal(sanitiseStyle({ standard: '2525' }, DEFAULT_STYLE).standard, '2525')
})

test('keys added in a later version are backfilled from the defaults', () => {
  // A blob written before outlineText and square existed.
  const old = { size: 50, colorMode: 'Dark', frame: true }
  const style = sanitiseStyle(old, DEFAULT_STYLE)
  assert.equal(style.size, 50)
  assert.equal(style.outlineText, DEFAULT_STYLE.outlineText)
  assert.equal(style.square, DEFAULT_STYLE.square)
})

test('insert options are validated the same way', () => {
  assert.equal(sanitiseInsert({ layout: 'teleport' }, DEFAULT_INSERT).layout, DEFAULT_INSERT.layout)
  assert.equal(sanitiseInsert({ layout: 'selection' }, DEFAULT_INSERT).layout, 'selection')
  assert.equal(sanitiseInsert({ columns: 0 }, DEFAULT_INSERT).columns, 1)
  assert.equal(sanitiseInsert({ columns: 9999 }, DEFAULT_INSERT).columns, 40)
  assert.equal(sanitiseInsert({ targetHeight: -10 }, DEFAULT_INSERT).targetHeight, 0)
  assert.equal(sanitiseInsert({ frameName: 'x'.repeat(500) }, DEFAULT_INSERT).frameName.length, 120)
})

test('stored code lists drop anything that is not a code, and are capped', () => {
  assert.deepEqual(sanitiseCodes(null, 10), [])
  assert.deepEqual(sanitiseCodes('not a list', 10), [])
  assert.deepEqual(
    sanitiseCodes(['140310001512110000000000000000', 'nope', 42, null, '1403100015121100000000000000A0'], 10),
    ['140310001512110000000000000000', '1403100015121100000000000000A0']
  )
  assert.equal(sanitiseCodes(Array(500).fill('140310001512110000000000000000'), 40).length, 40)
})

test('every style option is validated, so a new one cannot slip through unchecked', () => {
  // A blob where each key differs from the default but is still legal. Any key
  // the sanitiser does not handle keeps its default and is named by this test.
  const altered: Record<string, unknown> = {
    size: 64,
    frame: !DEFAULT_STYLE.frame,
    fill: !DEFAULT_STYLE.fill,
    icon: !DEFAULT_STYLE.icon,
    infoFields: !DEFAULT_STYLE.infoFields,
    colorMode: DEFAULT_STYLE.colorMode === 'Dark' ? 'Light' : 'Dark',
    monoColor: '#123456',
    outlineWidth: 7,
    outlineColor: '#654321',
    strokeWidth: 5,
    civilianColor: !DEFAULT_STYLE.civilianColor,
    standard: DEFAULT_STYLE.standard === 'APP6' ? '2525' : 'APP6',
    simpleStatusModifier: !DEFAULT_STYLE.simpleStatusModifier,
    padding: 9,
    infoSize: 33,
    outlineText: !DEFAULT_STYLE.outlineText,
    square: !DEFAULT_STYLE.square,
  }
  const defaultKeys = Object.keys(DEFAULT_STYLE).sort()
  assert.deepEqual(
    Object.keys(altered).sort(),
    defaultKeys,
    'SymbolStyle gained or lost a key; update this test and the sanitiser together'
  )

  const result = sanitiseStyle(altered, DEFAULT_STYLE) as unknown as Record<string, unknown>
  const unvalidated = defaultKeys.filter(
    k => result[k] === (DEFAULT_STYLE as unknown as Record<string, unknown>)[k]
  )
  assert.deepEqual(unvalidated, [], 'these style options are not read by sanitiseStyle')
})

test('every insert option is validated too', () => {
  const altered: Record<string, unknown> = {
    layout: DEFAULT_INSERT.layout === 'grid' ? 'row' : 'grid',
    targetHeight: 96,
    columns: 9,
    gap: 11,
    asComponents: !DEFAULT_INSERT.asComponents,
    wrapInFrame: !DEFAULT_INSERT.wrapInFrame,
    frameName: 'A different name',
    captions: !DEFAULT_INSERT.captions,
  }
  const defaultKeys = Object.keys(DEFAULT_INSERT).sort()
  assert.deepEqual(Object.keys(altered).sort(), defaultKeys, 'InsertOptions gained or lost a key')

  const result = sanitiseInsert(altered, DEFAULT_INSERT) as unknown as Record<string, unknown>
  const unvalidated = defaultKeys.filter(
    k => result[k] === (DEFAULT_INSERT as unknown as Record<string, unknown>)[k]
  )
  assert.deepEqual(unvalidated, [], 'these insert options are not read by sanitiseInsert')
})
