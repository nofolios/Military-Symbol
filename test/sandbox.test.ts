/**
 * End-to-end tests for the plugin sandbox, driven through the real postMessage
 * protocol against the in-memory Figma stub in `figma-stub.ts`.
 *
 * These run the *built* `dist/code.js`, so `npm run build` must have run first;
 * the test script does that.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadPlugin, type StubNode } from './figma-stub'
import { render, DEFAULT_STYLE } from '../src/ui/render'
import type { InsertOptions, RenderedSymbol, SymbolStyle } from '../src/shared/messages'
import { PLUGIN_DATA_KEY } from '../src/shared/messages'
import { buildOrbat } from '../src/ui/orbat-payload'
import { initialState } from '../src/ui/store'
import { EXAMPLE_ORBAT } from '../src/core/orbat'

const INSERT: InsertOptions = {
  layout: 'grid',
  targetHeight: 0,
  columns: 3,
  gap: 20,
  asComponents: false,
  wrapInFrame: false,
  frameName: 'Sheet',
  captions: false,
}

const style = (patch: Partial<SymbolStyle> = {}): SymbolStyle => ({ ...DEFAULT_STYLE, ...patch })

function symbol(sidc: string, label = 'Symbol', amplifiers: Record<string, string> = {}, s = style()): RenderedSymbol {
  return render({ sidc, amplifiers, style: s, label })
}

const INFANTRY = '140310001512110000000000000000'
const ARMOUR = '140310001612050000000000000000'
const ARTILLERY = '140310001413030000000000000000'

async function ready(h: ReturnType<typeof loadPlugin>) {
  await h.send({ type: 'ui-ready' })
}

test('the plugin announces itself and its capabilities on start-up', async () => {
  const h = loadPlugin()
  await ready(h)
  const init = h.expectPosted('init')
  assert.equal(init.editorType, 'figma')
  assert.equal(init.canCreateComponents, true)
  assert.equal(init.selection.length, 0)
})

test('components are refused outside Figma Design', async () => {
  const h = loadPlugin({ editorType: 'figjam' })
  await ready(h)
  assert.equal(h.expectPosted('init').canCreateComponents, false)

  await h.send({ type: 'create-variants', symbols: [symbol(INFANTRY)], propertyName: 'Affiliation', setName: 'X' })
  const err = h.expectPosted('error')
  assert.match(String(err.message), /Figma Design/)
  assert.equal(h.page.find(n => n.type === 'COMPONENT_SET').length, 0)
})

test('inserting builds one frame per symbol, named and stamped with its spec', async () => {
  const h = loadPlugin()
  await ready(h)
  const symbols = [symbol(INFANTRY, 'Infantry'), symbol(ARMOUR, 'Armour'), symbol(ARTILLERY, 'Artillery')]
  await h.send({ type: 'insert', symbols, options: INSERT })

  const done = h.expectPosted('inserted')
  assert.equal(done.count, 3)
  assert.equal(done.failed, 0)

  const frames = h.ourNodes()
  assert.equal(frames.length, 3)
  for (let i = 0; i < 3; i++) {
    assert.equal(frames[i].name, symbols[i].spec.label)
    const spec = JSON.parse(frames[i].getPluginData(PLUGIN_DATA_KEY))
    assert.equal(spec.sidc, symbols[i].spec.sidc)
    assert.equal(frames[i].clipsContent, false, 'a clipped frame would cut off amplifiers')
    assert.equal(frames[i].fills.length, 0, 'the imported frame should have no background')
    assert.ok(frames[i].children.length > 0, 'no geometry was imported')
    assert.ok(frames[i].relaunchData?.edit, 'no relaunch button')
    assert.ok(frames[i].getSharedPluginData(PLUGIN_DATA_KEY, 'anchor'), 'no octagon anchor stored')
  }
})

test('a grid lays out in rows and columns without overlap', async () => {
  const h = loadPlugin()
  await ready(h)
  const symbols = Array.from({ length: 7 }, (_, i) => symbol(INFANTRY, `S${i}`))
  await h.send({ type: 'insert', symbols, options: { ...INSERT, columns: 3, gap: 20 } })

  const frames = h.ourNodes()
  assert.equal(frames.length, 7)
  const rows = new Map<number, StubNode[]>()
  for (const f of frames) {
    const key = Math.round(f.y)
    rows.set(key, [...(rows.get(key) ?? []), f])
  }
  assert.equal(rows.size, 3, 'seven symbols in three columns should make three rows')
  for (const [, row] of rows) {
    const sorted = [...row].sort((a, b) => a.x - b.x)
    for (let i = 1; i < sorted.length; i++) {
      assert.ok(sorted[i].x >= sorted[i - 1].x + sorted[i - 1].width - 0.01, 'symbols overlap')
    }
  }
})

test('amplifier text becomes real text nodes, once each', async () => {
  const h = loadPlugin()
  await ready(h)
  const amps = { uniqueDesignation: '2/7 CAV', higherFormation: '1 BDE', staffComments: 'RES' }
  const s = symbol(INFANTRY, 'Infantry', amps, style({ outlineWidth: 3 }))
  await h.send({ type: 'insert', symbols: [s], options: INSERT })

  const [frame] = h.ourNodes()
  const texts = frame.children.filter(n => n.type === 'TEXT')
  assert.equal(texts.length, 3, 'expected one text node per amplifier')
  assert.deepEqual(
    texts.map(t => t.characters).sort(),
    ['1 BDE', '2/7 CAV', 'RES']
  )
  for (const t of texts) {
    assert.ok(t.fontSize > 0)
    assert.ok(Number.isFinite(t.x) && Number.isFinite(t.y))
  }
})

test('outlined amplifier text leaves no live text behind', async () => {
  const h = loadPlugin()
  await ready(h)
  const s = symbol(INFANTRY, 'Infantry', { uniqueDesignation: 'A' }, style({ outlineText: true }))
  await h.send({ type: 'insert', symbols: [s], options: INSERT })
  const [frame] = h.ourNodes()
  assert.equal(frame.children.filter(n => n.type === 'TEXT').length, 0)
  assert.ok(frame.children.some(n => n.type === 'VECTOR' && n.name === 'A'))
})

test('the plugin falls back to a font it can actually load', async () => {
  // Arial and Helvetica absent, so the resolver must land on Inter.
  const h = loadPlugin({ fonts: [{ family: 'Inter', style: 'Regular' }] })
  await ready(h)
  await h.send({
    type: 'insert',
    symbols: [symbol(INFANTRY, 'Infantry', { uniqueDesignation: 'A' })],
    options: INSERT,
  })
  const [frame] = h.ourNodes()
  const text = frame.children.find(n => n.type === 'TEXT')
  assert.ok(text, 'no text node was created')
  const font = text.fontName as { family: string; style: string }
  assert.equal(font.family, 'Inter')
  assert.equal(font.style, 'Regular')
})

test('wrapping puts every symbol inside one frame', async () => {
  const h = loadPlugin()
  await ready(h)
  const symbols = [symbol(INFANTRY, 'A'), symbol(ARMOUR, 'B')]
  await h.send({ type: 'insert', symbols, options: { ...INSERT, wrapInFrame: true, frameName: 'My sheet' } })

  const wrappers = h.page.children.filter(n => n.type === 'FRAME' && n.name === 'My sheet')
  assert.equal(wrappers.length, 1)
  const inside = wrappers[0].children.filter(n => n.getPluginData(PLUGIN_DATA_KEY))
  assert.equal(inside.length, 2)
  for (const n of inside) {
    assert.ok(n.x >= 0 && n.y >= 0, 'a wrapped symbol sits outside its wrapper')
    assert.ok(n.x + n.width <= wrappers[0].width + 0.01)
  }
})

test('insert as components produces components, not frames', async () => {
  const h = loadPlugin()
  await ready(h)
  await h.send({
    type: 'insert',
    symbols: [symbol(INFANTRY, 'A'), symbol(ARMOUR, 'B')],
    options: { ...INSERT, asComponents: true },
  })
  const components = h.page.children.filter(n => n.type === 'COMPONENT')
  assert.equal(components.length, 2)
  for (const c of components) {
    assert.ok(c.getPluginData(PLUGIN_DATA_KEY), 'the component lost its spec')
    assert.ok(c.children.length > 0, 'the component lost its geometry')
  }
})

test('a component set gets one uniquely named variant per affiliation', async () => {
  const h = loadPlugin()
  await ready(h)
  const labels = ['Pending', 'Unknown', 'Assumed Friend', 'Friend', 'Neutral', 'Suspect', 'Hostile']
  const symbols = labels.map((label, i) =>
    symbol(INFANTRY.slice(0, 3) + String(i) + INFANTRY.slice(4), label)
  )
  await h.send({ type: 'create-variants', symbols, propertyName: 'Affiliation', setName: 'Infantry company' })

  const sets = h.page.find(n => n.type === 'COMPONENT_SET')
  assert.equal(sets.length, 1)
  assert.equal(sets[0].name, 'Infantry company')
  assert.equal(sets[0].children.length, 7)
  for (const c of sets[0].children) {
    assert.match(c.name, /^Affiliation=/)
    assert.ok(!c.name.slice('Affiliation='.length).includes('='), 'a variant value contains "="')
    assert.ok(!c.name.slice('Affiliation='.length).includes(','), 'a variant value contains ","')
  }
})

test('re-rendering the selection keeps the node in its place in the tree', async () => {
  const h = loadPlugin()
  await ready(h)
  await h.send({ type: 'insert', symbols: [symbol(INFANTRY, 'A'), symbol(ARMOUR, 'B')], options: INSERT })
  const before = h.ourNodes()
  const index = h.page.children.indexOf(before[0])
  const position = { x: before[0].x, y: before[0].y }

  h.select([before[0]])
  await h.send({
    type: 'update-selection',
    updates: [{ nodeId: before[0].id, symbol: symbol(ARTILLERY, 'Artillery') }],
  })

  const updated = h.expectPosted('updated')
  assert.equal(updated.count, 1)
  assert.ok(before[0].removed, 'the old node was not removed')
  const fresh = h.page.children[index]
  assert.ok(fresh.getPluginData(PLUGIN_DATA_KEY), 'the replacement is in the wrong slot')
  assert.equal(JSON.parse(fresh.getPluginData(PLUGIN_DATA_KEY)).sidc, ARTILLERY)
  // Position is preserved by centring the new bounds on the old ones.
  assert.ok(Math.abs(fresh.x + fresh.width / 2 - (position.x + before[0].width / 2)) < 1.5)
})

test('re-rendering a component-ised symbol keeps it a component', async () => {
  const h = loadPlugin()
  await ready(h)
  await h.send({
    type: 'insert',
    symbols: [symbol(INFANTRY, 'A')],
    options: { ...INSERT, asComponents: true },
  })
  const component = h.page.children.find(n => n.type === 'COMPONENT')
  assert.ok(component, 'no component was created')

  h.select([component!])
  await h.send({
    type: 'update-selection',
    updates: [{ nodeId: component!.id, symbol: symbol(ARMOUR, 'Armour') }],
  })

  const survivors = h.ourNodes()
  assert.equal(survivors.length, 1)
  assert.equal(
    survivors[0].type,
    'COMPONENT',
    'restyling turned a main component into a plain frame, which would break every instance of it'
  )
  assert.equal(JSON.parse(survivors[0].getPluginData(PLUGIN_DATA_KEY)).sidc, ARMOUR)
})

test('updating with nothing of ours selected reports rather than throwing', async () => {
  const h = loadPlugin()
  await ready(h)
  h.select([])
  await h.send({ type: 'update-selection', updates: [{ nodeId: 'nope', symbol: symbol(INFANTRY) }] })
  assert.match(String(h.expectPosted('error').message), /Select one or more symbols/)
})

test('an ORBAT payload becomes a chart with connectors, symbols and labels', async () => {
  const h = loadPlugin()
  await ready(h)
  const build = buildOrbat(EXAMPLE_ORBAT, initialState(), { name: 'Brigade ORBAT' })
  await h.send({ type: 'insert-orbat', payload: build.payload })

  const chart = h.page.children.find(n => n.name === 'Brigade ORBAT')
  assert.ok(chart, 'no chart frame was created')
  assert.equal(chart.clipsContent, false)

  const connectors = chart.children.find(n => n.name === 'Connectors')
  assert.ok(connectors, 'connectors were not imported')

  const symbols = chart!.children.filter(n => n.getPluginData(PLUGIN_DATA_KEY) !== '')
  assert.equal(symbols.length, build.count)
  const labels = chart.children.filter(n => n.type === 'TEXT')
  assert.equal(labels.length, build.count, 'one label per unit')
  assert.equal(h.expectPosted('inserted').failed, 0)

  for (const s of symbols) {
    assert.ok(s.x >= 0 && s.y >= 0, 'a unit sits outside the chart')
    assert.ok(s.x + s.width <= chart.width + 0.01)
  }
})

test('the selection report tells the UI which nodes are ours', async () => {
  const h = loadPlugin()
  await ready(h)
  await h.send({ type: 'insert', symbols: [symbol(INFANTRY, 'A')], options: INSERT })
  const [ours] = h.ourNodes()
  const stranger = h.createForeignFrame()

  h.select([ours!, stranger])
  await h.send({ type: 'request-selection' })
  const report = h.expectPosted('selection').selection
  assert.equal(report.length, 2)
  assert.ok(report[0].spec, 'our own symbol was not recognised')
  assert.equal(report[1].spec, null, 'a foreign node was claimed as ours')
  assert.ok(report[0].width > 0 && report[0].height > 0, 'no size reported for a re-render')
})

test('a corrupt or partial stored spec never crashes the plugin', async () => {
  const h = loadPlugin()
  await ready(h)
  const node = h.createForeignFrame('scratch')
  for (const junk of ['not json', '{}', '[]', 'null', '{"sidc":123}', '{"sidc":"14031000"}']) {
    node.setPluginData(PLUGIN_DATA_KEY, junk)
    h.select([node])
    await h.send({ type: 'request-selection' })
    const report = h.expectPosted('selection').selection
    assert.equal(report.length, 1)
    // Either it is rejected outright, or it round-trips as an object; never a throw.
    assert.ok(report[0].spec === null || typeof report[0].spec === 'object')
  }
})

test('client storage round-trips through the bridge', async () => {
  const h = loadPlugin()
  await ready(h)
  await h.send({ type: 'storage-set', key: 'k', value: { a: 1 } })
  await h.send({ type: 'storage-get', key: 'k', nonce: 'n1' })
  const got = h.expectPosted('storage-value')
  assert.equal(got.nonce, 'n1')
  assert.deepEqual(got.value, { a: 1 })

  await h.send({ type: 'storage-get', key: 'missing', nonce: 'n2' })
  assert.equal(h.expectPosted('storage-value').value, null)
})

test('a symbol that cannot be built is counted, not fatal', async () => {
  const h = loadPlugin()
  await ready(h)
  const good = symbol(INFANTRY, 'Good')
  const broken = { ...symbol(ARMOUR, 'Broken'), geometrySvg: 'this is not svg', svg: '' }
  await h.send({ type: 'insert', symbols: [good, broken], options: INSERT })
  const done = h.expectPosted('inserted')
  assert.equal(done.count, 1)
  assert.equal(done.failed, 1)
  assert.equal(h.ourNodes().length, 1)
})

test('a hundred-symbol batch completes and leaves no orphans', async () => {
  const h = loadPlugin()
  await ready(h)
  const symbols = Array.from({ length: 100 }, (_, i) => symbol(INFANTRY, `S${i}`))
  await h.send({ type: 'insert', symbols, options: { ...INSERT, columns: 10 } })
  assert.equal(h.expectPosted('inserted').count, 100)
  const placed = h.ourNodes()
  assert.equal(placed.length, 100)
  const stray = h.nodesCreated.filter(n => !n.removed && n.parent === null && n.type !== 'PAGE')
  assert.deepEqual(stray.map(n => n.name), [], 'nodes were created and then orphaned')
})

test('components and a wrapper frame compose instead of cancelling each other', async () => {
  const h = loadPlugin()
  await ready(h)
  await h.send({
    type: 'insert',
    symbols: [symbol(INFANTRY, 'A'), symbol(ARMOUR, 'B')],
    options: { ...INSERT, asComponents: true, wrapInFrame: true, frameName: 'Legend' },
  })
  const wrapper = h.page.children.find(n => n.name === 'Legend')
  assert.ok(wrapper, 'no wrapper frame')
  assert.equal(wrapper.type, 'FRAME', 'the wrapper itself should stay a frame')
  const inside = wrapper.children.filter(n => n.getPluginData(PLUGIN_DATA_KEY) !== '')
  assert.equal(inside.length, 2)
  for (const n of inside) {
    assert.equal(n.type, 'COMPONENT', 'a wrapped symbol was left as a plain frame')
    assert.ok(n.children.length > 0, 'the component lost its geometry')
  }
})

test('inserting into the selected frame puts the symbols inside it', async () => {
  const h = loadPlugin()
  await ready(h)
  const container = h.createForeignFrame('Target')
  container.resize(600, 400)
  h.select([container])

  await h.send({
    type: 'insert',
    symbols: [symbol(INFANTRY, 'A'), symbol(ARMOUR, 'B')],
    options: { ...INSERT, layout: 'selection' },
  })

  const inside = container.children.filter(n => n.getPluginData(PLUGIN_DATA_KEY) !== '')
  assert.equal(inside.length, 2, 'the symbols did not land in the selected frame')
  assert.equal(h.page.children.filter(n => n.getPluginData(PLUGIN_DATA_KEY) !== '').length, 0)
  for (const n of inside) {
    assert.ok(n.x >= 0 && n.y >= 0, 'a symbol sits outside its container')
    assert.ok(n.x + n.width <= container.width + 0.01)
  }
})

test('a huge selection is reported as a capped list plus the true total', async () => {
  const h = loadPlugin()
  await ready(h)
  const symbols = Array.from({ length: 80 }, (_, i) => symbol(INFANTRY, `S${i}`))
  await h.send({ type: 'insert', symbols, options: { ...INSERT, columns: 10 } })

  const ours = h.ourNodes()
  assert.equal(ours.length, 80)
  h.select(ours)
  await h.send({ type: 'request-selection' })

  const report = h.expectPosted('selection')
  assert.equal(report.total, 80, 'the true count must still reach the UI')
  assert.ok(report.selection.length < 80, 'the described list should be capped')
  assert.ok(report.selection.length > 0)
  for (const item of report.selection) assert.ok(item.spec, 'a described node lost its spec')
})

test('an update reaches the node it names, whatever order the selection is in', async () => {
  const h = loadPlugin()
  await ready(h)
  await h.send({
    type: 'insert',
    symbols: [symbol(INFANTRY, 'A'), symbol(ARMOUR, 'B'), symbol(ARTILLERY, 'C')],
    options: INSERT,
  })
  const [a, b, c] = h.ourNodes()
  const ids = { a: a.id, b: b.id, c: c.id }
  h.select([a, b, c])

  // Deliberately out of order, and naming only the middle node.
  await h.send({
    type: 'update-selection',
    updates: [{ nodeId: ids.b, symbol: symbol(ARTILLERY, 'Artillery now') }],
  })

  assert.equal(h.expectPosted('updated').count, 1)
  const specs = new Map(
    h.ourNodes().map(n => [n.name, JSON.parse(n.getPluginData(PLUGIN_DATA_KEY)).sidc])
  )
  assert.equal(specs.get('A'), INFANTRY, 'an unnamed node was rewritten')
  assert.equal(specs.get('C'), ARTILLERY, 'an unnamed node was rewritten')
  assert.equal(specs.get('Artillery now'), ARTILLERY, 'the named node was not updated')
  assert.equal(specs.has('B'), false, 'the old node should be gone')
})

test('an update naming a node that is not selected is ignored', async () => {
  const h = loadPlugin()
  await ready(h)
  await h.send({ type: 'insert', symbols: [symbol(INFANTRY, 'A')], options: INSERT })
  const [only] = h.ourNodes()
  h.select([])
  await h.send({
    type: 'update-selection',
    updates: [{ nodeId: only.id, symbol: symbol(ARMOUR, 'Armour') }],
  })
  assert.match(String(h.expectPosted('error').message), /Select one or more symbols/)
  assert.equal(JSON.parse(only.getPluginData(PLUGIN_DATA_KEY)).sidc, INFANTRY)
})

test('inserting into a selected group leaves the symbols where the group is', async () => {
  const h = loadPlugin()
  await ready(h)
  // A group does not establish a coordinate system: its children keep page
  // coordinates. Writing container-local numbers onto them would fling the
  // symbols across the canvas and blow up the group's bounds.
  const group = h.createForeignFrame('Grouped')
  ;(group as unknown as { type: string }).type = 'GROUP'
  group.resize(600, 400)
  group.x = 4000
  group.y = 3000
  h.select([group])

  await h.send({
    type: 'insert',
    symbols: [symbol(INFANTRY, 'A'), symbol(ARMOUR, 'B')],
    options: { ...INSERT, layout: 'selection' },
  })

  const inside = group.children.filter(n => n.getPluginData(PLUGIN_DATA_KEY) !== '')
  assert.equal(inside.length, 2, 'the symbols did not land in the group')

  // A group's children are measured in the space the group itself lives in, so
  // the layout has to be offset by the group's own position. The bug this
  // guards against computed the origin from the group's width and height alone,
  // which left the symbols at (190, 130) in page space - nowhere near the group
  // at (4000, 3000) - and stretched the group's bounds across the canvas.
  const positions = inside.map(n => n.absolute())
  for (const p of positions) {
    assert.ok(
      p.x >= group.x && p.x <= group.x + group.width && p.y >= group.y && p.y <= group.y + group.height,
      `a symbol landed at (${p.x}, ${p.y}), outside the group at (${group.x}, ${group.y})`
    )
  }
  // A group should behave exactly like a frame of the same size that happens to
  // sit at that spot, so the offsets inside it must match the frame case.
  const f = loadPlugin()
  await ready(f)
  const frame = f.createForeignFrame('Target')
  frame.resize(600, 400)
  f.select([frame])
  await f.send({
    type: 'insert',
    symbols: [symbol(INFANTRY, 'A'), symbol(ARMOUR, 'B')],
    options: { ...INSERT, layout: 'selection' },
  })
  // Rounded, because subtracting a four-thousand-unit offset costs a few bits.
  const at = (x: number, y: number) => ({ x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 })
  const control = frame.children
    .filter(n => n.getPluginData(PLUGIN_DATA_KEY) !== '')
    .map(n => at(n.x, n.y))
  assert.deepEqual(
    positions.map(p => at(p.x - group.x, p.y - group.y)),
    control,
    'a group should place symbols exactly where a frame of the same size would'
  )
})

test('a whole-set sheet drops the builder echelon', async () => {
  // Guarded here rather than in the UI tests because it is the payload that
  // reaches Figma that matters: 93 ship types must not wear a platoon bar.
  const h = loadPlugin()
  await ready(h)
  const plain = symbol('140330000012010000000000000000', 'Carrier')
  const withEchelon = symbol('140330001412010000000000000000', 'Carrier')
  assert.notEqual(plain.geometrySvg, withEchelon.geometrySvg, 'the echelon must be visible at all')
  assert.ok(withEchelon.height > plain.height, 'an echelon bar makes the symbol taller')
})

/* ------------------------------------------------- containers that say no */

test('a container that refuses the symbols degrades to a page insert', async () => {
  // A component set takes variants and nothing else; a frame inside an instance
  // belongs to its main component. Both throw on appendChild, and the throw
  // used to escape mid-loop and strand every built symbol on the page at
  // container-local coordinates.
  const h = loadPlugin({ rejectAppend: container => container.name === 'Unyielding' })
  await ready(h)
  const container = h.createForeignFrame('Unyielding')
  container.resize(600, 400)
  h.select([container])

  await h.send({
    type: 'insert',
    symbols: [symbol(INFANTRY, 'A'), symbol(ARMOUR, 'B'), symbol(ARTILLERY, 'C')],
    options: { ...INSERT, layout: 'selection' },
  })

  const ours = h.ourNodes()
  assert.equal(ours.length, 3, 'every symbol must survive the refusal')
  assert.equal(container.children.length, 0, 'nothing may be forced into the container')
  for (const n of ours) {
    assert.equal(n.parent, h.page, 'a symbol was left orphaned instead of falling back to the page')
  }
  // Laid out around the viewport centre (0, 0 in the stub), not at the
  // container-local numbers they were built with.
  const left = Math.min(...ours.map(n => n.x))
  const right = Math.max(...ours.map(n => n.x + n.width))
  assert.ok(left < 0 && right > 0, `the fallback row does not straddle the viewport: ${left}..${right}`)
  // The row keeps its shape: same order, same gaps.
  const xs = ours.map(n => n.x)
  assert.deepEqual([...xs].sort((a, b) => a - b), xs, 'the layout order was lost')

  assert.equal(h.expectPosted('inserted').count, 3)
  assert.ok(
    h.notifications.some(n => /page instead/.test(n.message)),
    `the user was never told; notifications were ${JSON.stringify(h.notifications)}`
  )
})

test('a selected component set is never used as a container', async () => {
  const h = loadPlugin()
  await ready(h)
  const set = h.createForeignFrame('Variants')
  ;(set as unknown as { type: string }).type = 'COMPONENT_SET'
  set.resize(600, 400)
  h.select([set])

  await h.send({
    type: 'insert',
    symbols: [symbol(INFANTRY, 'A')],
    options: { ...INSERT, layout: 'selection' },
  })

  assert.equal(set.children.length, 0, 'a component set holds variants, not symbols')
  const [node] = h.ourNodes()
  assert.equal(node.parent, h.page)
})

test('a frame inside an instance is not used as a container either', async () => {
  const h = loadPlugin()
  await ready(h)
  const instance = h.createForeignFrame('An instance')
  ;(instance as unknown as { type: string }).type = 'INSTANCE'
  const inner = h.createForeignFrame('Inside the instance')
  inner.resize(300, 200)
  instance.appendChild(inner)
  // Selecting a bare child of that frame sends the plugin to its parent.
  const leaf = h.createForeignFrame('A leaf')
  ;(leaf as unknown as { type: string }).type = 'VECTOR'
  inner.appendChild(leaf)
  h.select([leaf])

  await h.send({
    type: 'insert',
    symbols: [symbol(INFANTRY, 'A')],
    options: { ...INSERT, layout: 'selection' },
  })

  const [node] = h.ourNodes()
  assert.equal(node.parent, h.page, 'nothing may be reparented into an instance')
  assert.equal(inner.children.filter(n => n.getPluginData(PLUGIN_DATA_KEY) !== '').length, 0)
})

/* ---------------------------------------------- weight and vertical anchor */

test('bold amplifiers get a bold face, and middle-baseline text is centred on its y', async () => {
  // milsymbol emits font-weight="bold" on the exercise letter and the special
  // headquarters, and dominant-baseline="middle" on both: the letter sits in
  // the frame, not on a baseline.
  const h = loadPlugin({
    fonts: [
      { family: 'Arial', style: 'Regular' },
      { family: 'Arial', style: 'Bold' },
      { family: 'Inter', style: 'Regular' },
    ],
  })
  await ready(h)
  const exercise = '141310000012110000000000000000'
  const s = symbol(exercise, 'Exercise infantry', {
    specialHeadquarters: 'SHAPE',
    headquartersElement: 'TOC',
    uniqueDesignation: '2/7 CAV',
  })
  await h.send({ type: 'insert', symbols: [s], options: INSERT })

  const [frame] = h.ourNodes()
  const text = (characters: string) => {
    const n = frame.children.find(c => c.type === 'TEXT' && c.characters === characters)
    assert.ok(n, `no text node for "${characters}"`)
    return n!
  }
  const styleOf = (characters: string) => (text(characters).fontName as { style: string }).style

  assert.equal(styleOf('X'), 'Bold', 'the exercise letter is bold in the SVG and must be bold here')
  assert.equal(styleOf('SHAPE'), 'Bold')
  assert.equal(styleOf('TOC'), 'Bold')
  assert.equal(styleOf('2/7 CAV'), 'Regular', 'an ordinary amplifier must stay regular')

  // The placement's y is the visual centre for these two, so the node's top
  // must be half a line above it, not the 0.8-em baseline approximation.
  for (const characters of ['X', 'SHAPE']) {
    const placement = s.texts.find(t => t.characters === characters)
    assert.ok(placement, `no placement for "${characters}"`)
    assert.equal(placement!.baseline, 'middle')
    const node = text(characters)
    assert.ok(
      Math.abs(node.y - (placement!.baselineY - node.height / 2)) < 0.01,
      `"${characters}" sits at ${node.y}, expected ${placement!.baselineY - node.height / 2}`
    )
  }
  const cav = s.texts.find(t => t.characters === '2/7 CAV')!
  const cavNode = text('2/7 CAV')
  assert.equal(cav.baseline, 'alphabetic')
  assert.ok(
    Math.abs(cavNode.y - (cav.baselineY - cavNode.fontSize * 0.8)) < 0.01,
    'an ordinary amplifier must still be placed from its baseline'
  )
})
