import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EMPTY_SIDC, parseSidc } from '../src/core/sidc'
import {
  DEFAULT_METRICS, EXAMPLE_ORBAT, flatten, indentWidth, layoutOrbat, parseLine, parseOrbat,
} from '../src/core/orbat'

const base = { ...EMPTY_SIDC, symbolSet: '10', entity: '121100' }

test('indentWidth counts tabs as two spaces', () => {
  assert.equal(indentWidth('no indent'), 0)
  assert.equal(indentWidth('  two'), 2)
  assert.equal(indentWidth('\tone tab'), 2)
  assert.equal(indentWidth('\t  mixed'), 4)
})

test('parseLine splits the label from its directives', () => {
  const t = parseLine('1-7 Infantry | bn | hq | 121100')
  assert.equal(t.label, '1-7 Infantry')
  assert.equal(t.echelon, '16')
  assert.equal(t.hq, true)
  assert.equal(t.entity, '121100')
  assert.deepEqual(t.unknownTokens, [])
})

test('parseLine accepts a full SIDC, echelon codes and affiliation names', () => {
  assert.equal(parseLine('X | 140310001512110000000000000000').sidc, '140310001512110000000000000000')
  assert.equal(parseLine('X | 15').echelon, '15')
  assert.equal(parseLine('X | hostile').affiliation, '6')
  assert.equal(parseLine('X | Brigade').echelon, '18')
  assert.equal(parseLine('X | theatre').echelon, '25')
})

test('parseLine reports directives it does not understand', () => {
  const t = parseLine('A | wibble')
  assert.deepEqual(t.unknownTokens, ['wibble'])
})

test('indentation builds the hierarchy', () => {
  const { roots, count } = parseOrbat('A\n  B\n    C\n  D\nE', base)
  assert.equal(count, 5)
  assert.equal(roots.length, 2)
  assert.equal(roots[0].label, 'A')
  assert.deepEqual(roots[0].children.map(c => c.label), ['B', 'D'])
  assert.deepEqual(roots[0].children[0].children.map(c => c.label), ['C'])
  assert.equal(roots[1].label, 'E')
})

test('tabs and spaces both indent', () => {
  const { roots } = parseOrbat('A\n\tB\n\t\tC', base)
  assert.equal(roots.length, 1)
  assert.equal(roots[0].children[0].children[0].label, 'C')
})

test('blank lines and comments are ignored', () => {
  const { roots, count } = parseOrbat('# a comment\nA\n\n  B\n', base)
  assert.equal(count, 2)
  assert.equal(roots[0].children.length, 1)
})

test('children inherit the parent code but not its HQ flag', () => {
  const { roots } = parseOrbat('BDE | bde | hq\n  BN | bn', base)
  const parent = parseSidc(roots[0].sidc)
  const child = parseSidc(roots[0].children[0].sidc)
  assert.equal(parent.hqtfd, '2', 'parent is an HQ')
  assert.equal(child.hqtfd, '0', 'child is not')
  assert.equal(child.entity, parent.entity, 'entity inherited')
  assert.equal(parent.amplifier, '18')
  assert.equal(child.amplifier, '16')
})

test('an explicit affiliation cascades to descendants', () => {
  const { roots } = parseOrbat('OPFOR | hostile | div\n  1 MRR | regiment\n    1 MRB | bn', base)
  const all = flatten(roots)
  for (const n of all) {
    assert.equal(parseSidc(n.sidc).standardIdentity, '6', `${n.label} should be hostile`)
  }
})

test('every produced SIDC is a well-formed 30-digit code', () => {
  const { roots } = parseOrbat(EXAMPLE_ORBAT, base)
  for (const n of flatten(roots)) {
    assert.match(n.sidc, /^\d{30}$/, `${n.label}: ${n.sidc}`)
  }
})

test('layout places one row per depth and never overlaps siblings', () => {
  const { roots } = parseOrbat(EXAMPLE_ORBAT, base)
  const layout = layoutOrbat(roots)
  assert.equal(layout.nodes.length, flatten(roots).length)

  const rowY = new Map<number, number>()
  for (const n of layout.nodes) {
    if (rowY.has(n.depth)) assert.equal(n.y, rowY.get(n.depth), 'same depth shares a row')
    else rowY.set(n.depth, n.y)
  }

  // Siblings must not overlap horizontally.
  const byParent = new Map<string | null, typeof layout.nodes>()
  for (const n of layout.nodes) {
    const list = byParent.get(n.parentId) ?? []
    list.push(n)
    byParent.set(n.parentId, list)
  }
  for (const [, siblings] of byParent) {
    const sorted = [...siblings].sort((a, b) => a.x - b.x)
    for (let i = 1; i < sorted.length; i++) {
      assert.ok(
        sorted[i].x >= sorted[i - 1].x + sorted[i - 1].width - 0.01,
        `overlap between ${sorted[i - 1].label} and ${sorted[i].label}`
      )
    }
  }
})

test('layout normalises to a non-negative origin and reports its extent', () => {
  const { roots } = parseOrbat(EXAMPLE_ORBAT, base)
  const layout = layoutOrbat(roots)
  assert.ok(layout.nodes.every(n => n.x >= -0.01 && n.y >= -0.01), 'no negative coordinates')
  assert.equal(Math.min(...layout.nodes.map(n => n.x)), 0)
  assert.ok(layout.width > 0 && layout.height > 0)
  assert.equal(layout.width, Math.max(...layout.nodes.map(n => n.x + n.width)))
})

test('a parent is centred over its children', () => {
  const { roots } = parseOrbat('P\n  A\n  B\n  C', base)
  const layout = layoutOrbat(roots)
  const byLabel = new Map(layout.nodes.map(n => [n.label, n]))
  const centre = (l: string) => byLabel.get(l)!.x + byLabel.get(l)!.width / 2
  assert.ok(Math.abs(centre('P') - centre('B')) < 0.01, 'centred over the middle child')
  assert.ok(Math.abs(centre('P') - (centre('A') + centre('C')) / 2) < 0.01)
})

test('connectors run from every child up to its parent', () => {
  const { roots } = parseOrbat(EXAMPLE_ORBAT, base)
  const layout = layoutOrbat(roots)
  const withParent = layout.nodes.filter(n => n.parentId)
  assert.equal(layout.connectors.length, withParent.length)

  const byId = new Map(layout.nodes.map(n => [n.id, n]))
  for (const c of layout.connectors) {
    const parent = byId.get(c.from)!
    const child = byId.get(c.to)!
    const first = c.points[0]
    const last = c.points[c.points.length - 1]
    assert.ok(Math.abs(first.y - (parent.y + parent.height)) < 0.01, 'starts at the parent bottom')
    assert.ok(Math.abs(last.y - child.y) < 0.01, 'ends at the child top')
    assert.ok(Math.abs(last.x - (child.x + child.width / 2)) < 0.01, 'ends at the child centre')
    assert.ok(c.points.every(p => Number.isFinite(p.x) && Number.isFinite(p.y)))
  }
})

test('layout honours custom metrics', () => {
  const { roots } = parseOrbat('P\n  A\n  B', base)
  const wide = layoutOrbat(roots, { ...DEFAULT_METRICS, cellWidth: 200, hGap: 100 })
  const narrow = layoutOrbat(roots, { ...DEFAULT_METRICS, cellWidth: 50, hGap: 10 })
  assert.ok(wide.width > narrow.width)
})

test('an empty document lays out to nothing rather than throwing', () => {
  const { roots, count } = parseOrbat('   \n\n# only comments\n', base)
  assert.equal(count, 0)
  const layout = layoutOrbat(roots)
  assert.deepEqual(layout.nodes, [])
  assert.deepEqual(layout.connectors, [])
  assert.equal(layout.width, 0)
  assert.equal(layout.height, 0)
})

test('a line with no label is reported as a problem', () => {
  const { problems } = parseOrbat('| bn', base)
  assert.equal(problems.length, 1)
  assert.match(problems[0].message, /No label/)
})

test('a child without its own echelon gets none, rather than its parent\'s', () => {
  const { roots } = parseOrbat('1 BDE | bde\n  1-7 IN\n    A Coy | company', base)
  const bde = parseSidc(roots[0].sidc)
  const bn = parseSidc(roots[0].children[0].sidc)
  const coy = parseSidc(roots[0].children[0].children[0].sidc)
  assert.equal(bde.amplifier, '18', 'brigade keeps its own echelon')
  assert.equal(bn.amplifier, '00', 'a silent child must not inherit brigade')
  assert.equal(coy.amplifier, '15', 'an explicit echelon still wins')
})

test('joker and faker also set the exercise context', () => {
  const { roots } = parseOrbat('J | joker\nF | faker\nH | hostile\nS | sim', base)
  const [joker, faker, hostile, sim] = roots.map(r => parseSidc(r.sidc))
  assert.equal(joker.standardIdentity, '5')
  assert.equal(joker.context, '1', 'a joker is a suspect inside an exercise')
  assert.equal(faker.standardIdentity, '6')
  assert.equal(faker.context, '1', 'a faker is a hostile inside an exercise')
  assert.equal(hostile.context, '0', 'a plain hostile stays in reality')
  assert.equal(sim.context, '2')
})
