/**
 * Symbology safety net. Everything the user sees is produced by
 * `src/ui/render.ts`, so these tests exercise the whole catalogue through it
 * and pin the standards-conformance behaviour that is easy to break silently:
 * the Suspect-colour workaround, the APP-6 glyph switch, and the narrow SVG
 * vocabulary Figma's importer has to understand.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  AMPLIFIER_FIELDS, DEFAULT_STYLE, canDraw, extractText, hasIconGeometry, isDrawable,
  render, renderSvg, renderingSidc,
} from '../src/ui/render'
import { symbolSets } from '../src/core/catalog'
import { APP6E_VERSION, EMPTY_SIDC, formatSidc, type Sidc } from '../src/core/sidc'
import type { SymbolSpec, SymbolStyle } from '../src/shared/messages'

/* ----------------------------------------------------------------- helpers */

function sidcOf(patch: Partial<Sidc>): string {
  return formatSidc({ ...EMPTY_SIDC, ...patch })
}

function specOf(
  sidc: string,
  amplifiers: Record<string, string | number> = {},
  style: Partial<SymbolStyle> = {}
): SymbolSpec {
  return { sidc, amplifiers, style: { ...DEFAULT_STYLE, ...style }, label: sidc }
}

interface Root {
  attrs: Record<string, string>
  viewBox: number[]
  width: number
  height: number
}

/** Parse the root `<svg>` element's attributes. Throws if there isn't one. */
function rootOf(svg: string): Root {
  const m = svg.match(/^<svg\b([^>]*)>/)
  assert.ok(m, `SVG does not start with an <svg> root: ${svg.slice(0, 120)}`)
  const attrs: Record<string, string> = {}
  const re = /([a-zA-Z_:][\w:.-]*)\s*=\s*"([^"]*)"/g
  let a: RegExpExecArray | null
  while ((a = re.exec(m[1]))) attrs[a[1]] = a[2]
  return {
    attrs,
    viewBox: (attrs.viewBox ?? '').split(/[\s,]+/).filter(Boolean).map(Number),
    width: parseFloat(attrs.width),
    height: parseFloat(attrs.height),
  }
}

/** Assert an SVG string is structurally sound enough for `createNodeFromSvg`. */
function assertWellFormed(svg: string, what: string) {
  assert.ok(svg.length > 0, `${what}: empty SVG`)
  const r = rootOf(svg)
  assert.ok(svg.trimEnd().endsWith('</svg>'), `${what}: unterminated root element`)
  assert.equal(r.attrs.xmlns, 'http://www.w3.org/2000/svg', `${what}: missing or wrong xmlns`)
  assert.equal(r.viewBox.length, 4, `${what}: viewBox "${r.attrs.viewBox}" is not four numbers`)
  assert.ok(r.viewBox.every(Number.isFinite), `${what}: viewBox "${r.attrs.viewBox}" has a non-finite number`)
  assert.ok(r.viewBox[2] > 0 && r.viewBox[3] > 0, `${what}: viewBox has a non-positive extent`)
  assert.ok(Number.isFinite(r.width) && r.width > 0, `${what}: width "${r.attrs.width}"`)
  assert.ok(Number.isFinite(r.height) && r.height > 0, `${what}: height "${r.attrs.height}"`)
  return r
}

/** Every entity in the catalogue as a renderable SIDC. */
function everyEntity(patch: Partial<Sidc> = {}) {
  const out: { setCode: string; code: string; name: string; sidc: string }[] = []
  for (const s of symbolSets) {
    for (const e of s.entities) {
      out.push({ setCode: s.code, code: e.c, name: e.n, sidc: sidcOf({ ...patch, symbolSet: s.code, entity: e.c }) })
    }
  }
  return out
}

/** A spread of entities across every symbol set, for the cheaper sweeps. */
function sample(perSet: number, patch: Partial<Sidc> = {}) {
  const out: { setCode: string; code: string; name: string; sidc: string }[] = []
  for (const s of symbolSets) {
    const step = Math.max(1, Math.floor(s.entities.length / perSet))
    for (let i = 0, taken = 0; i < s.entities.length && taken < perSet; i += step, taken++) {
      const e = s.entities[i]
      out.push({ setCode: s.code, code: e.c, name: e.n, sidc: sidcOf({ ...patch, symbolSet: s.code, entity: e.c }) })
    }
  }
  return out
}

/* ------------------------------------------------- full-catalogue smoke test */

test('every entity in every symbol set renders', () => {
  const all = everyEntity()
  assert.ok(all.length > 1700, `expected the whole catalogue, got ${all.length}`)

  const failures: string[] = []
  let rendered = 0
  for (const e of all) {
    try {
      const r = render(specOf(e.sidc))
      assertWellFormed(r.svg, `${e.setCode}/${e.code} ${e.name}`)
      assert.ok(r.width > 0 && r.height > 0, 'reported size must be positive')
      assert.ok(Number.isFinite(r.width) && Number.isFinite(r.height), 'reported size must be finite')
      // `geometrySvg` is what the sandbox imports, so it must survive too.
      assertWellFormed(r.geometrySvg, `${e.setCode}/${e.code} geometry`)
      rendered++
    } catch (err) {
      failures.push(`${e.setCode}/${e.code} "${e.name}" (${e.sidc}): ${(err as Error).message}`)
    }
  }

  console.log(`smoke: rendered ${rendered}/${all.length} entities`)
  assert.deepEqual(failures.slice(0, 20), [], `${failures.length} entities failed to render`)
  assert.equal(rendered, all.length)
})

test('milsymbol reports the catalogue renderable, except for line and area control measures', () => {
  // Control Measures (25) holds lines, areas and corridors that have no point
  // symbol at all; everything else must come back valid or the UI will warn.
  const invalidBySet = new Map<string, number>()
  for (const e of everyEntity()) {
    if (!render(specOf(e.sidc)).valid) invalidBySet.set(e.setCode, (invalidBySet.get(e.setCode) ?? 0) + 1)
  }
  console.log('invalid by set:', JSON.stringify(Object.fromEntries(invalidBySet)))
  assert.deepEqual([...invalidBySet.keys()], ['25'], 'only Control Measures may contain unrenderable entities')
  assert.ok(invalidBySet.get('25')! < symbolSets.find(s => s.code === '25')!.entities.length,
    'some control measures must still be renderable as points')
})

test('hasIconGeometry distinguishes a real icon from a bare frame', () => {
  assert.equal(hasIconGeometry(sidcOf({ symbolSet: '10', entity: '000000' })), false, 'a zeroed entity is a bare frame')
  assert.equal(hasIconGeometry(sidcOf({ symbolSet: '10', entity: '121100' })), true, 'Infantry draws an icon')
  assert.equal(hasIconGeometry(sidcOf({ symbolSet: '15', entity: '120200' })), true, 'Tank draws an icon')
})

/* --------------------------------------------------------- affiliation sweep */

test('the seven standard identities render distinct frames', () => {
  const picks = sample(2)
  assert.ok(picks.length >= 38, `expected ~40 samples, got ${picks.length}`)

  // The standard requires these to differ: the four canonical frame shapes, and
  // each dashed "pending/assumed/suspect" form against its solid counterpart.
  const mustDiffer: ReadonlyArray<readonly [string, string]> = [
    ['1', '3'], ['1', '4'], ['1', '6'], ['3', '4'], ['3', '6'], ['4', '6'],
    ['0', '1'], ['2', '3'], ['5', '6'],
  ]

  const problems: string[] = []
  const skipped: string[] = []
  let checked = 0
  for (const p of picks) {
    const byIdentity = new Map<string, string>()
    let framed = true
    for (const si of ['0', '1', '2', '3', '4', '5', '6']) {
      const r = render(specOf(sidcOf({ symbolSet: p.setCode, entity: p.code, standardIdentity: si })))
      assertWellFormed(r.svg, `${p.setCode}/${p.code} si=${si}`)
      byIdentity.set(si, r.svg)
      if (!r.valid) framed = false
    }
    if (!framed) { skipped.push(`${p.setCode}/${p.code} ${p.name}`); continue }
    checked++
    for (const [a, b] of mustDiffer) {
      if (byIdentity.get(a) === byIdentity.get(b)) {
        problems.push(`${p.setCode}/${p.code} "${p.name}": identity ${a} and ${b} render identically`)
      }
    }
  }

  console.log(`affiliation sweep: ${checked} framed symbols x 7 identities; skipped ${skipped.length} unframed control measures`)
  assert.deepEqual(problems, [])
  assert.ok(checked >= 35, `expected at least 35 framed samples, got ${checked}`)
})

test('affiliation drives the frame fill colour', () => {
  const fillOf = (si: string) => {
    const svg = renderSvg(specOf(sidcOf({ symbolSet: '10', entity: '121100', standardIdentity: si })))
    return (svg.match(/fill="(rgb\([^)]*\))"/) ?? [])[1]
  }
  assert.equal(fillOf('3'), 'rgb(128,224,255)', 'Friend is cyan')
  assert.equal(fillOf('6'), 'rgb(255,128,128)', 'Hostile is red')
  assert.equal(fillOf('4'), 'rgb(170,255,170)', 'Neutral is green')
  assert.equal(fillOf('1'), 'rgb(255,255,128)', 'Unknown is yellow')
})

/* --------------------------------------------------- Suspect colour regression */

test('renderingSidc rewrites only the leading version digits', () => {
  const suspect = sidcOf({ standardIdentity: '5', symbolSet: '10', entity: '121100' })
  assert.ok(suspect.startsWith(APP6E_VERSION))
  const rewritten = renderingSidc(suspect)
  assert.equal(rewritten.slice(0, 2), '13', 'the "14" must become "13"')
  assert.equal(rewritten.slice(2), suspect.slice(2), 'nothing after position 2 may change')
  assert.equal(rewritten.length, suspect.length)

  // A 2525E code is already "13" and must be left exactly as it is.
  const e2525 = '13' + suspect.slice(2)
  assert.equal(renderingSidc(e2525), e2525)
  // D-edition codes are not "14" either, so they pass through untouched.
  assert.equal(renderingSidc('10' + suspect.slice(2)), '10' + suspect.slice(2))
  assert.equal(renderingSidc('11' + suspect.slice(2)), '11' + suspect.slice(2))
  // A "14" anywhere but the front must not be rewritten.
  assert.equal(renderingSidc('10031400001411000000000000000000'), '10031400001411000000000000000000')
})

test('a Suspect symbol built as version 14 still renders the amber Suspect fill', () => {
  // milsymbol 3.0.4 gates the Suspect colour on `version == 13`, so without the
  // renderingSidc() workaround an APP-6E ("14") Suspect loses its amber and
  // falls back to the Hostile red.
  const SUSPECT_AMBER = 'rgb(255, 229, 153)'
  for (const setCode of ['10', '15', '01', '30', '40']) {
    const entity = symbolSets.find(s => s.code === setCode)!.entities.find(e => e.c.endsWith('00'))!
    const sidc = sidcOf({ standardIdentity: '5', symbolSet: setCode, entity: entity.c })
    const svg = renderSvg(specOf(sidc))
    assert.ok(svg.includes(SUSPECT_AMBER), `set ${setCode}: Suspect must be filled ${SUSPECT_AMBER}`)
    assert.ok(!svg.includes('fill="rgb(255,128,128)"'), `set ${setCode}: Suspect must not fall back to Hostile red`)
  }

  // And the workaround must be what produces it: the raw "14" code does not.
  const raw = renderSvg({ ...specOf(sidcOf({ standardIdentity: '5', symbolSet: '10', entity: '121100' })) })
  assert.ok(raw.includes(SUSPECT_AMBER))
  assert.equal(renderingSidc(sidcOf({ standardIdentity: '5' })).slice(0, 2), '13')
})

test('versions 13 and 14 render byte-identically', () => {
  // The whole workaround rests on this: the two E-edition versions differ only
  // in milsymbol's buggy Suspect test.
  for (const p of sample(3)) {
    for (const si of ['1', '3', '4', '6']) {
      const s14 = sidcOf({ version: '14', standardIdentity: si, symbolSet: p.setCode, entity: p.code })
      const s13 = '13' + s14.slice(2)
      assert.equal(renderSvg(specOf(s14)), renderSvg(specOf(s13)), `${p.setCode}/${p.code} si=${si}`)
    }
  }
})

/* ------------------------------------------------------------ APP6 vs 2525 */

test('the APP6 standard option actually changes the glyphs', () => {
  // Verified candidates: milsymbol draws these differently under APP-6 and
  // MIL-STD-2525. If the option stopped being applied they would all collapse.
  const candidates: ReadonlyArray<readonly [string, string, string]> = [
    ['01', '110100', 'Air / Fixed Wing'],
    ['05', '120300', 'Space / Satellite'],
    ['10', '200200', 'Land Unit / Border Patrol'],
    ['15', '160100', 'Land Equipment / Automobile'],
    ['10', '130900', 'Land Unit / Survey'],
  ]
  const differing: string[] = []
  for (const [setCode, entity, name] of candidates) {
    const sidc = sidcOf({ symbolSet: setCode, entity })
    const app6 = renderSvg(specOf(sidc, {}, { standard: 'APP6' }))
    const us2525 = renderSvg(specOf(sidc, {}, { standard: '2525' }))
    assertWellFormed(app6, `${name} APP6`)
    assertWellFormed(us2525, `${name} 2525`)
    if (app6 !== us2525) differing.push(name)
  }
  console.log(`APP6 vs 2525: ${differing.length}/${candidates.length} candidates differ — ${differing.join(', ')}`)
  assert.ok(differing.length >= 3, `expected at least three glyph differences, got ${differing.length}`)

  // A broad sweep, so a wholesale loss of the APP-6 table is caught too.
  let sweepDiffs = 0
  for (const p of sample(8)) {
    if (renderSvg(specOf(p.sidc, {}, { standard: 'APP6' })) !== renderSvg(specOf(p.sidc, {}, { standard: '2525' }))) sweepDiffs++
  }
  console.log(`APP6 vs 2525: ${sweepDiffs} differences across the sampled catalogue`)
  assert.ok(sweepDiffs > 0, 'no sampled symbol differed between APP6 and 2525')
})

/* ----------------------------------------------- SVG element/attribute inventory */

/**
 * Figma's SVG importer only has to cope with what milsymbol emits, and
 * research/04-figma-plugin-platform.md §2.3 enumerates that vocabulary. Anything
 * outside it has never been checked against `createNodeFromSvg`, so it must
 * fail here rather than be discovered on someone's canvas.
 */
const ALLOWED_ELEMENTS = new Set(['svg', 'g', 'path', 'circle', 'text'])
const ALLOWED_ATTRIBUTES = new Set([
  'xmlns', 'version', 'baseProfile', 'width', 'height', 'viewBox',
  'd', 'cx', 'cy', 'r', 'x', 'y', 'transform',
  'stroke', 'stroke-width', 'stroke-dasharray', 'fill', 'fill-opacity',
  'font-family', 'font-size', 'font-weight', 'text-anchor', 'dominant-baseline',
  // §2.3 records these two as present in milsymbol's source and supported by
  // Figma (strokeCap / strokeJoin); the sweep below does produce them.
  'stroke-linecap', 'stroke-linejoin',
])

function inventory(svg: string, elements: Set<string>, attributes: Set<string>) {
  const tag = /<\s*(\/?)([a-zA-Z_:][\w:.-]*)([^>]*?)\/?>/g
  let m: RegExpExecArray | null
  while ((m = tag.exec(svg))) {
    elements.add(m[2])
    if (m[1] === '/') continue
    const attr = /([a-zA-Z_:][\w:.-]*)\s*=\s*"([^"]*)"/g
    let a: RegExpExecArray | null
    while ((a = attr.exec(m[3]))) attributes.add(a[1])
  }
}

test('the emitted SVG stays inside the vocabulary Figma has been checked against', () => {
  const elements = new Set<string>()
  const attributes = new Set<string>()

  const textAmplifiers: Record<string, string | number> = {
    uniqueDesignation: '2/7 CAV', higherFormation: '1 BDE', additionalInformation: 'AI',
    staffComments: 'SC', type: 'M1A2', quantity: '12', dtg: '301400ZSEP97',
    location: '0900000.0E570306.0N', altitudeDepth: '300M', speed: '30KPH',
    combatEffectiveness: 'GREEN', signatureEquipment: '!', reinforcedReduced: '(+)',
    evaluationRating: 'A1', iffSif: 'IFF', headquartersElement: 'HQ',
    commonIdentifier: 'HAWK', platformType: 'ELNOT', equipmentTeardownTime: '20',
    direction: 45,
  }
  // Echelons, mobility, towed array and leadership, so the amplifier geometry
  // below and around the frame is exercised.
  const amplifierCodes = ['00', '11', '15', '18', '21', '26', '31', '33', '35', '42', '52', '61', '71']
  const identities = ['0', '1', '2', '3', '4', '5', '6']
  const statuses = ['0', '1', '2', '3', '4', '5'] // 1 dashes the frame, 3-5 draw condition bars
  const hqtfds = ['0', '1', '2', '4', '6']

  let n = 0
  let i = 0
  for (const p of sample(40)) {
    i++
    const sidc = sidcOf({
      symbolSet: p.setCode, entity: p.code,
      standardIdentity: identities[i % identities.length],
      status: statuses[i % statuses.length],
      hqtfd: hqtfds[i % hqtfds.length],
      amplifier: amplifierCodes[i % amplifierCodes.length],
    })
    const amps: Record<string, string | number> =
      i % 3 === 0 ? textAmplifiers : i % 3 === 1 ? { uniqueDesignation: 'A1', direction: 270 } : {}
    const r = render(specOf(sidc, amps, { outlineWidth: i % 5 === 0 ? 2 : 0 }))
    inventory(r.svg, elements, attributes)
    n++
  }

  console.log(`inventory: ${n} symbols`)
  console.log(`  elements:   ${[...elements].sort().join(', ')}`)
  console.log(`  attributes: ${[...attributes].sort().join(', ')}`)

  assert.ok(n >= 400, `expected 400+ varied symbols, rendered ${n}`)
  const badElements = [...elements].filter(e => !ALLOWED_ELEMENTS.has(e)).sort()
  const badAttributes = [...attributes].filter(a => !ALLOWED_ATTRIBUTES.has(a)).sort()
  assert.deepEqual(badElements, [], 'milsymbol emitted an SVG element Figma has not been checked against')
  assert.deepEqual(badAttributes, [], 'milsymbol emitted an SVG attribute Figma has not been checked against')
  // The sweep must actually be wide enough to see the interesting cases.
  for (const expected of ['svg', 'g', 'path', 'text']) {
    assert.ok(elements.has(expected), `the sweep never produced a <${expected}>`)
  }
  for (const expected of ['viewBox', 'd', 'transform', 'stroke-width', 'fill', 'text-anchor']) {
    assert.ok(attributes.has(expected), `the sweep never produced ${expected}`)
  }
})

/* --------------------------------------------------------- text extraction */

test('extractText lifts every amplifier out of the SVG and into frame pixels', () => {
  const amplifiers = {
    quantity: '12', dtg: '301400ZSEP97', uniqueDesignation: '2/7 CAV',
    higherFormation: '1 BDE', speed: '30KPH', combatEffectiveness: 'GREEN',
  }
  const spec = specOf(sidcOf({ symbolSet: '10', entity: '121100' }), amplifiers)
  const r = render(spec)

  // Every amplifier string must come back, and nothing must be left behind.
  const found = r.texts.map(t => t.characters)
  for (const v of Object.values(amplifiers)) {
    assert.ok(found.includes(v), `"${v}" was not extracted; got ${JSON.stringify(found)}`)
  }
  assert.equal(r.texts.length, (r.svg.match(/<text\b/g) ?? []).length, 'every <text> must be accounted for')
  assert.ok(!/<text\b/.test(r.geometrySvg), 'geometrySvg must contain no <text>')
  assert.ok(/<path\b/.test(r.geometrySvg), 'geometrySvg must still contain the geometry')

  const anchors = new Set(r.texts.map(t => t.anchor))
  for (const t of r.texts) {
    assert.ok(['start', 'middle', 'end'].includes(t.anchor), `bad anchor ${t.anchor}`)
    assert.ok(Number.isFinite(t.x) && Number.isFinite(t.baselineY), `non-finite placement for "${t.characters}"`)
    assert.ok(t.x >= 0 && t.x <= r.width, `"${t.characters}" x=${t.x} outside 0..${r.width}`)
    assert.ok(t.baselineY >= 0 && t.baselineY <= r.height, `"${t.characters}" y=${t.baselineY} outside 0..${r.height}`)
    assert.ok(t.fontSize > 0 && Number.isFinite(t.fontSize), `bad font size for "${t.characters}"`)
    assert.ok(t.color.length > 0, `no colour for "${t.characters}"`)
  }
  assert.deepEqual([...anchors].sort(), ['end', 'middle', 'start'], 'all three anchors must be exercised')
})

test('text-anchor maps through unchanged and the coordinate transform is right', () => {
  const spec = specOf(sidcOf({ symbolSet: '10', entity: '121100' }), { quantity: '12', uniqueDesignation: 'ABC' })
  const r = render(spec)
  const root = rootOf(r.svg)
  const [vx, vy, vw, vh] = root.viewBox
  const sx = root.width / vw
  const sy = root.height / vh

  // Check every placement against the raw <text> it came from.
  const raw = [...r.svg.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)].map(m => {
    const attrs: Record<string, string> = {}
    const re = /([a-zA-Z_:][\w:.-]*)\s*=\s*"([^"]*)"/g
    let a: RegExpExecArray | null
    while ((a = re.exec(m[1]))) attrs[a[1]] = a[2]
    return { attrs, characters: m[2].replace(/<[^>]*>/g, '').trim() }
  })

  assert.equal(raw.length, r.texts.length)
  for (const t of r.texts) {
    const src = raw.find(x => x.characters === t.characters)
    assert.ok(src, `no raw <text> for "${t.characters}"`)
    const ux = parseFloat(src.attrs.x)
    const uy = parseFloat(src.attrs.y)
    assert.ok(Math.abs(t.x - (ux - vx) * sx) < 1e-9, `"${t.characters}" x: ${t.x} vs ${(ux - vx) * sx}`)
    assert.ok(Math.abs(t.baselineY - (uy - vy) * sy) < 1e-9, `"${t.characters}" y: ${t.baselineY} vs ${(uy - vy) * sy}`)
    assert.ok(Math.abs(t.fontSize - parseFloat(src.attrs['font-size']) * sy) < 1e-9, `"${t.characters}" font size`)
    const srcAnchor = src.attrs['text-anchor']
    assert.equal(t.anchor, srcAnchor === 'middle' || srcAnchor === 'end' ? srcAnchor : 'start')
  }

  // And one placement worked out by hand, so a change of convention (say,
  // dropping the viewBox origin) cannot slip past the loop above.
  const quantity = r.texts.find(t => t.characters === '12')!
  const rawQuantity = raw.find(x => x.characters === '12')!
  assert.equal(rawQuantity.attrs['text-anchor'], 'middle', 'the quantity amplifier is centred over the frame')
  assert.equal(quantity.x, (parseFloat(rawQuantity.attrs.x) - vx) * (root.width / vw))
  assert.equal(quantity.baselineY, (parseFloat(rawQuantity.attrs.y) - vy) * (root.height / vh))
})

test('extractText copes with an SVG that has no text at all', () => {
  const r = render(specOf(sidcOf({ symbolSet: '10', entity: '121100' })))
  assert.deepEqual(r.texts, [])
  assert.equal(r.geometrySvg, r.svg, 'nothing to strip means nothing changes')
})

test('extractText falls back to the reported size when the root has no viewBox', () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50"><text x="10" y="20" font-size="8">Hi</text></svg>'
  const { texts, width, height } = extractText(svg, { width: 100, height: 50 })
  assert.equal(width, 100)
  assert.equal(height, 50)
  assert.equal(texts.length, 1)
  assert.equal(texts[0].x, 10)
  assert.equal(texts[0].baselineY, 20)
  assert.equal(texts[0].anchor, 'start')
})

/* -------------------------------------------------------------- size baking */

test('targetHeight is baked into the render to within half a pixel', () => {
  const heights = [16, 24, 48, 96, 240]
  const cases = [
    specOf(sidcOf({ symbolSet: '10', entity: '121100' })),
    specOf(sidcOf({ symbolSet: '15', entity: '120200' })),
    specOf(sidcOf({ symbolSet: '01', entity: '110100', standardIdentity: '6' })),
    specOf(sidcOf({ symbolSet: '30', entity: '120100', standardIdentity: '4' })),
    specOf(sidcOf({ symbolSet: '20', entity: '110100' })),
    specOf(sidcOf({ symbolSet: '10', entity: '121100', amplifier: '18', status: '3' }),
      { uniqueDesignation: '2/7 CAV', higherFormation: '1 BDE', dtg: '301400ZSEP97', direction: 45 }),
  ]

  for (const spec of cases) {
    const unbaked = render(spec)
    const aspect = unbaked.width / unbaked.height
    for (const targetHeight of heights) {
      const r = render(spec, { targetHeight })
      assert.ok(Math.abs(r.height - targetHeight) <= 0.5,
        `${spec.sidc} @ ${targetHeight}px: got ${r.height}`)
      assert.ok(Math.abs(r.width / r.height - aspect) < 1e-6,
        `${spec.sidc} @ ${targetHeight}px: aspect ${r.width / r.height} vs ${aspect}`)
      assertWellFormed(r.svg, `${spec.sidc} @ ${targetHeight}px`)
      // The scale must be baked into milsymbol's own size, not applied after —
      // the root width/height are what Figma will use for the frame.
      const root = rootOf(r.svg)
      assert.ok(Math.abs(root.height - targetHeight) <= 0.5, 'the root height must carry the target')
    }
  }
})

test('a zero or absent targetHeight leaves the intrinsic size alone', () => {
  const spec = specOf(sidcOf({ symbolSet: '10', entity: '121100' }))
  const plain = render(spec)
  assert.equal(render(spec, {}).svg, plain.svg)
  assert.equal(render(spec, { targetHeight: 0 }).svg, plain.svg)
})

/* ------------------------------------------------------- amplifier options */

/**
 * Amplifier keys milsymbol 3.0.4 declares but never draws. Both appear in the
 * `textFields` gate in `milsymbol.development.js` (lines 2331 and 2342) yet are
 * never written into `gStrings`, so setting them alone or together changes
 * nothing in any symbol set. They are listed here so this test still fails if a
 * *different* key goes dead, or if an upgrade brings these two to life.
 */
const INERT_IN_MILSYMBOL = new Set(['sigint', 'auxiliaryEquipmentIndicator'])

/** Representative SIDCs: unit, equipment, installation, sea, activity, SIGINT, air, individual, cyber. */
const AMPLIFIER_PROBE_SIDCS = [
  sidcOf({ symbolSet: '10', entity: '121100' }),
  sidcOf({ symbolSet: '15', entity: '120200' }),
  sidcOf({ symbolSet: '20', entity: '110100' }),
  sidcOf({ symbolSet: '30', entity: '120100' }),
  sidcOf({ symbolSet: '40', entity: '110100' }),
  sidcOf({ symbolSet: '52', entity: '110000' }),
  sidcOf({ symbolSet: '01', entity: '110100' }),
  sidcOf({ symbolSet: '27', entity: '110100' }),
  sidcOf({ symbolSet: '60', entity: '110100' }),
]

function amplifierValue(key: string): string | number {
  if (key === 'direction') return 45
  if (key === 'quantity') return '12'
  if (key === 'sigint') return 'M'
  if (key === 'country') return 'USA'
  if (key === 'signatureEquipment') return '!'
  if (key === 'reinforcedReduced') return '(+)'
  if (key === 'evaluationRating') return 'A1'
  return 'XX'
}

test('every AMPLIFIER_FIELDS key names an option milsymbol honours', () => {
  const dead: string[] = []
  const live: string[] = []
  for (const field of AMPLIFIER_FIELDS) {
    const key = field.key
    // Several amplifiers only surface once another info field has opened the
    // text block, so each key is tried both alone and beside a companion.
    const companion = key === 'uniqueDesignation' ? 'higherFormation' : 'uniqueDesignation'
    let changed = false
    for (const sidc of AMPLIFIER_PROBE_SIDCS) {
      for (const base of [{}, { [companion]: 'BASE' }]) {
        const before = renderSvg(specOf(sidc, base))
        const after = renderSvg(specOf(sidc, { ...base, [key]: amplifierValue(key) }))
        if (before !== after) { changed = true; break }
      }
      if (changed) break
    }
    ;(changed ? live : dead).push(key)
  }

  console.log(`amplifiers: ${live.length}/${AMPLIFIER_FIELDS.length} keys change the rendered SVG`)
  if (dead.length > 0) console.log(`  inert: ${dead.join(', ')}`)

  const unexpectedlyDead = dead.filter(k => !INERT_IN_MILSYMBOL.has(k))
  assert.deepEqual(unexpectedlyDead, [],
    'these AMPLIFIER_FIELDS keys are not milsymbol option names, or no longer render')
  const unexpectedlyLive = [...INERT_IN_MILSYMBOL].filter(k => live.includes(k))
  assert.deepEqual(unexpectedlyLive, [],
    'these keys were inert in milsymbol 3.0.4 and now render — drop them from INERT_IN_MILSYMBOL')
})

test('AMPLIFIER_FIELDS is well formed', () => {
  const keys = AMPLIFIER_FIELDS.map(f => f.key)
  assert.equal(new Set(keys).size, keys.length, 'amplifier keys must be unique')
  for (const f of AMPLIFIER_FIELDS) {
    assert.ok(f.label.length > 0, `${f.key} has no label`)
    assert.match(f.field, /^[A-Z]{1,2}[0-9]?$/, `${f.key} has a malformed field id "${f.field}"`)
  }
  // `direction` is the one amplifier passed through as a number.
  const numeric = AMPLIFIER_FIELDS.filter(f => (f as { numeric?: boolean }).numeric === true)
  assert.deepEqual(numeric.map(f => f.key), ['direction'])
})

test('the direction amplifier draws a movement arrow', () => {
  const sidc = sidcOf({ symbolSet: '10', entity: '121100' })
  const plain = renderSvg(specOf(sidc))
  const north = renderSvg(specOf(sidc, { direction: 0 }))
  const east = renderSvg(specOf(sidc, { direction: 90 }))
  assert.notEqual(plain, north, 'a direction must add geometry')
  assert.notEqual(north, east, 'the arrow must follow the bearing')
})

/* ------------------------------------------------------------- determinism */

test('rendering the same spec twice is byte-identical', () => {
  const specs = [
    specOf(sidcOf({ symbolSet: '10', entity: '121100', amplifier: '18' }),
      { uniqueDesignation: '2/7 CAV', higherFormation: '1 BDE', direction: 45, quantity: '12' }),
    specOf(sidcOf({ symbolSet: '25', entity: '130300', standardIdentity: '6' })),
    specOf(sidcOf({ symbolSet: '30', entity: '120100', standardIdentity: '5', status: '3' })),
    specOf(sidcOf({ symbolSet: '15', entity: '120200' }), {}, { standard: '2525' }),
    specOf(sidcOf({ symbolSet: '01', entity: '110100' }), {}, { colorMode: 'mono', monoColor: '#112233' }),
  ]
  for (const spec of specs) {
    assert.equal(renderSvg(spec), renderSvg(spec), `renderSvg is not stable for ${spec.sidc}`)
    const a = render(spec, { targetHeight: 64 })
    const b = render(spec, { targetHeight: 64 })
    assert.equal(a.svg, b.svg, `render is not stable for ${spec.sidc}`)
    assert.equal(a.geometrySvg, b.geometrySvg)
    assert.deepEqual(a.texts, b.texts)
    assert.equal(a.width, b.width)
    assert.equal(a.height, b.height)
  }
})

test('interleaving the APP6 and 2525 standards does not leak between renders', () => {
  // `applyStandard` memoises milsymbol's global setStandard, so a stale cache
  // would show up as one of these round trips changing.
  const sidc = sidcOf({ symbolSet: '01', entity: '110100' })
  const app6 = renderSvg(specOf(sidc, {}, { standard: 'APP6' }))
  const us = renderSvg(specOf(sidc, {}, { standard: '2525' }))
  assert.notEqual(app6, us, 'this SIDC is meant to differ between the standards')
  for (let i = 0; i < 3; i++) {
    assert.equal(renderSvg(specOf(sidc, {}, { standard: 'APP6' })), app6)
    assert.equal(renderSvg(specOf(sidc, {}, { standard: '2525' })), us)
  }
})

/* ------------------------------------------------------- the insert gate */

test('canDraw rejects exactly the codes that render a question mark', () => {
  // The Free Fire Area from the finding: structurally perfect, no point symbol.
  const freeFireArea = sidcOf({ symbolSet: '25', entity: '240200' })
  assert.equal(canDraw(freeFireArea), false, 'a line/area control measure is not drawable')
  assert.equal(canDraw(sidcOf({ symbolSet: '10', entity: '121100' })), true, 'infantry is')
  // A bare frame draws nothing but a frame, which is still a real symbol.
  assert.equal(canDraw(sidcOf({ symbolSet: '10', entity: '000000' })), true, 'a bare frame is drawable')

  // And it must agree with what render() reports, across the whole catalogue.
  let undrawable = 0
  for (const e of everyEntity()) {
    const r = render(specOf(e.sidc))
    const drawable = canDraw(e.sidc)
    assert.equal(
      drawable,
      isDrawable(r),
      `${e.setCode}/${e.code} "${e.name}": canDraw said ${drawable}, render said valid=${r.valid} undefinedIcon=${r.undefinedIcon}`
    )
    if (!drawable) undrawable++
  }
  console.log(`insert gate: ${undrawable} of the catalogue cannot be drawn as a point symbol`)
  assert.ok(undrawable > 300, `expected the control measures to be caught, got ${undrawable}`)
})

test('extractText carries the bold weight and the middle baseline through', () => {
  // An exercise friend with the amplifiers milsymbol emits in bold: the context
  // letter X, the special headquarters and the headquarters element. The X and
  // the special headquarters are also the only two it centres vertically.
  const r = render(
    specOf(sidcOf({ context: '1', standardIdentity: '3', symbolSet: '10', entity: '121100' }), {
      specialHeadquarters: 'SHAPE',
      headquartersElement: 'TOC',
      uniqueDesignation: '2/7 CAV',
    })
  )
  const by = (characters: string) => {
    const t = r.texts.find(x => x.characters === characters)
    assert.ok(t, `no placement for "${characters}"; got ${r.texts.map(x => x.characters).join(', ')}`)
    return t!
  }

  assert.equal(by('X').bold, true, 'the exercise letter is bold in the SVG')
  assert.equal(by('SHAPE').bold, true)
  assert.equal(by('TOC').bold, true)
  assert.equal(by('2/7 CAV').bold, false, 'an ordinary amplifier is not bold')

  assert.equal(by('X').baseline, 'middle', 'the exercise letter is centred on its y')
  assert.equal(by('SHAPE').baseline, 'middle')
  assert.equal(by('2/7 CAV').baseline, 'alphabetic')

  // The SVG has to actually say so, or the extraction is reading nothing.
  assert.match(r.svg, /<text[^>]*font-weight="bold"/)
  assert.match(r.svg, /<text[^>]*dominant-baseline="middle"/)
})
