/**
 * The contract between the UI and the plugin sandbox.
 *
 * The sandbox cannot be run outside Figma, so these tests assert the promises
 * the UI makes about every payload it posts. If one of them breaks, the plugin
 * fails inside Figma with no stack trace worth reading, which is exactly the
 * failure this file exists to prevent.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EMPTY_SIDC, formatSidc, parseSidc, type Sidc } from '../src/core/sidc'
import { symbolSets } from '../src/core/catalog'
import { PRESETS } from '../src/data/presets'
import { DEFAULT_STYLE, render } from '../src/ui/render'
import { EXAMPLE_ORBAT, layoutOrbat, parseOrbat } from '../src/core/orbat'
import { buildOrbat, connectorSvg } from '../src/ui/orbat-payload'
import { initialState } from '../src/ui/store'
import type { RenderedSymbol, SymbolStyle } from '../src/shared/messages'

const style = (patch: Partial<SymbolStyle> = {}): SymbolStyle => ({ ...DEFAULT_STYLE, ...patch })

const spec = (sidc: string | Sidc, amplifiers: Record<string, string> = {}, s: SymbolStyle = style()) => ({
  sidc: typeof sidc === 'string' ? sidc : formatSidc(sidc),
  amplifiers,
  style: s,
  label: 'test symbol',
})

/** Everything `buildSymbolNode` in src/main/code.ts reads off a RenderedSymbol. */
function assertSandboxContract(r: RenderedSymbol, what: string) {
  assert.ok(r.geometrySvg && r.geometrySvg.length > 0, `${what}: geometrySvg is empty`)
  assert.match(r.geometrySvg, /^<svg\b/, `${what}: geometrySvg is not an SVG document`)
  assert.ok(!/<text\b/.test(r.geometrySvg), `${what}: geometrySvg still contains text`)
  assert.ok(/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/.test(r.geometrySvg), `${what}: missing xmlns`)
  assert.ok(Number.isFinite(r.width) && r.width > 0, `${what}: bad width`)
  assert.ok(Number.isFinite(r.height) && r.height > 0, `${what}: bad height`)
  assert.equal(typeof r.spec.label, 'string')
  assert.ok(r.spec.label.length > 0, `${what}: empty label`)
  assert.equal(typeof r.spec.style.outlineText, 'boolean', `${what}: outlineText missing`)
  assert.ok(Array.isArray(r.texts), `${what}: texts is not an array`)
  for (const t of r.texts) {
    assert.ok(t.characters.length > 0, `${what}: empty text run`)
    assert.ok(Number.isFinite(t.x) && Number.isFinite(t.baselineY), `${what}: non-finite text position`)
    assert.ok(Number.isFinite(t.fontSize) && t.fontSize > 0, `${what}: bad font size`)
    assert.ok(['start', 'middle', 'end'].includes(t.anchor), `${what}: bad anchor "${t.anchor}"`)
    assert.ok(typeof t.color === 'string' && t.color.length > 0, `${what}: bad colour`)
  }
  if (r.anchor) {
    assert.ok(Number.isFinite(r.anchor.x) && Number.isFinite(r.anchor.y), `${what}: non-finite anchor`)
    assert.ok(r.anchor.x >= -1 && r.anchor.x <= r.width + 1, `${what}: anchor x outside bounds`)
    assert.ok(r.anchor.y >= -1 && r.anchor.y <= r.height + 1, `${what}: anchor y outside bounds`)
  }
}

test('one symbol per symbol set satisfies the sandbox contract', () => {
  for (const set of symbolSets) {
    const entity = set.entities.find(e => !e.d)
    if (!entity) continue
    const r = render(spec({ ...EMPTY_SIDC, symbolSet: set.code, entity: entity.c }))
    assertSandboxContract(r, `set ${set.code} entity ${entity.c}`)
  }
})

test('every preset satisfies the sandbox contract', () => {
  for (const p of PRESETS) {
    assertSandboxContract(render(spec(p.sidc)), p.label)
  }
})

test('amplifier text never leaks into the geometry, at any outline width', () => {
  const amps = {
    uniqueDesignation: '2/7 CAV',
    higherFormation: '1 BDE',
    staffComments: 'RESERVE',
    type: 'M2A3',
    quantity: '14',
    dtg: '301400ZSEP97',
  }
  for (const outlineWidth of [0, 1, 4, 12]) {
    const r = render(spec('140310001512110000000000000000', amps, style({ outlineWidth })))
    assertSandboxContract(r, `outlineWidth ${outlineWidth}`)
    // The contrast outline duplicates every <text>; the placements must not.
    const seen = new Set(r.texts.map(t => `${t.characters}@${Math.round(t.x)},${Math.round(t.baselineY)}`))
    assert.equal(seen.size, r.texts.length, `outlineWidth ${outlineWidth}: duplicated text placements`)
    assert.equal(r.texts.length, Object.keys(amps).length, `outlineWidth ${outlineWidth}: wrong amplifier count`)
  }
})

test('text amplifiers stay inside the symbol bounds', () => {
  const r = render(spec('140330000012010000000000000000', {
    uniqueDesignation: 'HMS EXAMPLE',
    higherFormation: 'CTF 150',
    speed: '24KTS',
    altitudeDepth: '0',
  }))
  for (const t of r.texts) {
    assert.ok(t.x >= -1 && t.x <= r.width + 1, `${t.characters}: x ${t.x} outside 0..${r.width}`)
    assert.ok(t.baselineY >= -1 && t.baselineY <= r.height + 1, `${t.characters}: y outside 0..${r.height}`)
  }
})

test('turning amplifier text off produces no text placements at all', () => {
  const r = render(spec('140310001512110000000000000000', { uniqueDesignation: 'A' }, style({ infoFields: false })))
  assert.equal(r.texts.length, 0)
  assert.ok(!/<text\b/.test(r.svg))
})

test('an ORBAT payload is internally consistent', () => {
  const state = initialState()
  const build = buildOrbat(EXAMPLE_ORBAT, state, { name: 'contract' })
  const payload = build.payload
  assert.ok(payload, 'no payload produced')

  assert.ok(payload.width > 0 && payload.height > 0)
  assert.equal(payload.placements.length, build.count, 'a unit was dropped')

  for (const p of payload.placements) {
    assert.ok(p.index >= 0 && p.index < payload.symbols.length, `${p.label}: index out of range`)
    assert.ok(p.labelHeight >= 0 && p.labelHeight < p.height, `${p.label}: label strip does not fit`)
    assert.ok(p.x >= 0 && p.y >= 0, `${p.label}: negative origin`)
    assert.ok(p.x + p.width <= payload.width + 0.01, `${p.label}: overflows the chart`)
    assert.ok(p.y + p.height <= payload.height + 0.01, `${p.label}: overflows the chart`)
    assertSandboxContract(payload.symbols[p.index], p.label)
  }

  // The sandbox pins the connector SVG at the chart origin with no scaling, so
  // its declared box has to be the chart's own box.
  const root = payload.connectorSvg.match(/<svg[^>]*>/)
  assert.ok(root, 'connector SVG has no root element')
  const w = Number(root[0].match(/width="([\d.]+)"/)?.[1])
  const h = Number(root[0].match(/height="([\d.]+)"/)?.[1])
  assert.ok(Math.abs(w - payload.width) < 0.02, `connector width ${w} vs chart ${payload.width}`)
  assert.ok(Math.abs(h - payload.height) < 0.02, `connector height ${h} vs chart ${payload.height}`)
})

test('every ORBAT connector ends on the top edge centre of a cell', () => {
  const { roots } = parseOrbat(EXAMPLE_ORBAT, { ...EMPTY_SIDC, symbolSet: '10', entity: '121100' })
  const layout = layoutOrbat(roots)
  const byId = new Map(layout.nodes.map(n => [n.id, n]))
  for (const c of layout.connectors) {
    const child = byId.get(c.to)
    assert.ok(child, 'connector points at a missing node')
    const end = c.points[c.points.length - 1]
    assert.ok(Math.abs(end.x - (child.x + child.width / 2)) < 0.01)
    assert.ok(Math.abs(end.y - child.y) < 0.01)
  }
})

test('the connector SVG escapes its colour and degrades to empty', () => {
  assert.equal(connectorSvg([], 100, 100, '#000', 1), '')
  assert.equal(connectorSvg([{ points: [{ x: 0, y: 0 }] }], 0, 100, '#000', 1), '')
  const svg = connectorSvg([{ points: [{ x: 0, y: 0 }, { x: 10, y: 10 }] }], 20, 20, 'a"><script>b', 1)
  assert.ok(!svg.includes('<script>'), 'colour string was not escaped')
})

test('a SIDC survives the plugin-data round trip byte for byte', () => {
  for (const p of PRESETS.slice(0, 40)) {
    const original = render(spec(p.sidc, { uniqueDesignation: 'X' }))
    const stored = JSON.parse(JSON.stringify(original.spec))
    const again = render(stored)
    assert.equal(again.svg, original.svg, `${p.label} did not re-render identically`)
    assert.equal(formatSidc(parseSidc(stored.sidc)), p.sidc)
  }
})

test('the renderer agrees with itself about what it could not draw', () => {
  // `valid` and `undefinedIcon` are two independent signals from milsymbol:
  // one is its own validity verdict, the other is the question-mark glyph it
  // actually drew. Wherever it draws the question mark it must also be saying
  // the code is not renderable, or the UI would be reporting two different
  // stories about the same symbol.
  const setsToCheck = ['10', '15', '25', '30', '40']
  let checked = 0
  let undefinedCount = 0
  for (const setCode of setsToCheck) {
    const set = symbolSets.find(s => s.code === setCode)
    if (!set) continue
    for (const entity of set.entities) {
      const r = render(spec({ ...EMPTY_SIDC, symbolSet: setCode, entity: entity.c }))
      checked++
      if (r.undefinedIcon) {
        undefinedCount++
        assert.equal(r.valid, false, `${setCode}/${entity.c} drew a question mark but reports as valid`)
      }
    }
  }
  assert.ok(checked > 1000, `expected a broad sweep, checked ${checked}`)
  assert.ok(undefinedCount > 0, 'the sweep should have found some codes with no point symbol')
})
