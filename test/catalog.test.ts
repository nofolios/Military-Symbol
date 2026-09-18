/**
 * Catalogue integrity. The entity/modifier tables are generated at build time
 * from the milstandard-e TSVs, so a silent regeneration bug would quietly
 * change which symbols the plugin can even offer. These tests pin the shape of
 * the generated data, not milsymbol's rendering of it.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  catalog, catalogSize, entityLabel, entityPath, getEntity, getModifier, getSet,
  searchEntities, selectableModifiers, symbolSetCodes, symbolSets,
  type CatalogEntity, type CatalogSet,
} from '../src/core/catalog'

/**
 * The 20 symbol sets milstandard-e actually carries, with the entity counts
 * transcribed from research/03-catalog-data.md §2.4 (which were themselves
 * re-verified against `ms2525e[set].mainIcon.length`). Sets 00, 12 and 39 have
 * no source table and are deliberately absent.
 */
const EXPECTED_SETS: ReadonlyArray<readonly [string, number]> = [
  ['01', 53], ['02', 1], ['05', 36], ['06', 1], ['10', 214], ['11', 11],
  ['15', 206], ['20', 131], ['25', 628], ['27', 45], ['30', 93], ['35', 22],
  ['36', 65], ['40', 152], ['50', 4], ['51', 4], ['52', 4], ['53', 4],
  ['54', 4], ['60', 43],
]

const EXPECTED_ENTITY_TOTAL = EXPECTED_SETS.reduce((n, [, c]) => n + c, 0)

/* ------------------------------------------------------------------- shape */

test('the catalogue loads and declares its provenance', () => {
  assert.match(catalog.standard, /APP-6E/)
  assert.match(catalog.source, /milstandard-e/)
  assert.ok(Array.isArray(catalog.sets), 'catalog.sets must be an array')
})

test('the catalogue has the 20 documented symbol sets, with the documented codes', () => {
  assert.equal(symbolSets.length, 20)
  assert.deepEqual(symbolSets.map(s => s.code), EXPECTED_SETS.map(([c]) => c))
  // `symbolSetCodes` is what validateSidc is handed, so it must agree.
  assert.deepEqual([...symbolSetCodes].sort(), EXPECTED_SETS.map(([c]) => c).slice().sort())
})

test('each symbol set carries the documented entity count', () => {
  for (const [code, count] of EXPECTED_SETS) {
    const set = getSet(code)
    assert.ok(set, `symbol set ${code} is missing`)
    assert.equal(set.entities.length, count, `symbol set ${code} (${set.name}) entity count`)
  }
  assert.equal(catalogSize, EXPECTED_ENTITY_TOTAL, 'search index size must equal the entity total')
})

test('each symbol set is fully described', () => {
  for (const s of symbolSets) {
    assert.match(s.code, /^\d{2}$/, `set code ${s.code}`)
    assert.ok(s.name.length > 0, `set ${s.code} has no name`)
    assert.ok(s.dimension.length > 0, `set ${s.code} has no dimension`)
    assert.ok(s.group.length > 0, `set ${s.code} has no group`)
    assert.ok(Array.isArray(s.m1) && Array.isArray(s.m2), `set ${s.code} modifier tables`)
  }
  // Set names must be distinct or the UI's set picker is ambiguous. The five
  // SIGINT sets share a source table but differ by dimension suffix.
  assert.equal(new Set(symbolSets.map(s => s.name)).size, symbolSets.length, 'set names must be unique')
})

/* -------------------------------------------------------------- code shape */

test('every entity code is six digits and unique within its symbol set', () => {
  let total = 0
  for (const s of symbolSets) {
    const seen = new Set<string>()
    for (const e of s.entities) {
      assert.match(e.c, /^\d{6}$/, `set ${s.code}: entity code "${e.c}" (${e.n})`)
      assert.ok(!seen.has(e.c), `set ${s.code}: duplicate entity code ${e.c} (${e.n})`)
      seen.add(e.c)
      assert.ok(typeof e.n === 'string' && e.n.length > 0, `set ${s.code}/${e.c} has no name`)
      total++
    }
  }
  assert.equal(total, EXPECTED_ENTITY_TOTAL)
})

test('every modifier code is three digits and unique within (set, sector)', () => {
  let total = 0
  for (const s of symbolSets) {
    for (const sector of [1, 2] as const) {
      const list = sector === 1 ? s.m1 : s.m2
      const seen = new Set<string>()
      for (const m of list) {
        assert.match(m.c, /^\d{3}$/, `set ${s.code} sector ${sector}: modifier code "${m.c}" (${m.n})`)
        assert.ok(!seen.has(m.c), `set ${s.code} sector ${sector}: duplicate modifier ${m.c} (${m.n})`)
        seen.add(m.c)
        assert.ok(typeof m.n === 'string' && m.n.length > 0, `set ${s.code} sector ${sector}/${m.c} has no name`)
        total++
      }
    }
  }
  // Every set must offer at least one modifier in each sector; the shared
  // "common modifiers" table guarantees this even for Mine Warfare (36), whose
  // own sector tables are empty in the source package.
  for (const s of symbolSets) {
    assert.ok(s.m1.length > 0, `set ${s.code} has no sector-1 modifiers`)
    assert.ok(s.m2.length > 0, `set ${s.code} has no sector-2 modifiers`)
  }
  assert.ok(total > 2000, `expected a few thousand modifiers, got ${total}`)
})

test('withdrawn modifiers are flagged, kept for decoding and kept out of the pickers', () => {
  // The source tables keep withdrawn codes as "{Disused}" placeholders so the
  // numbering stays stable. milsymbol still has draw instructions for most of
  // them - they were legal in APP-6D - so offering one would stamp a glyph the
  // E edition has withdrawn.
  let disused = 0
  for (const s of symbolSets) {
    for (const sector of [1, 2] as const) {
      const list = sector === 1 ? s.m1 : s.m2
      for (const m of list) {
        if (!/^\{disused\}$/i.test(m.n)) {
          assert.notEqual(m.d, 1, `set ${s.code} sector ${sector}/${m.c} "${m.n}" is flagged withdrawn but named`)
          continue
        }
        disused++
        assert.equal(m.d, 1, `set ${s.code} sector ${sector}/${m.c} is "{Disused}" but not flagged`)
        // Still resolvable, so an old SIDC carrying it can be decoded.
        assert.ok(getModifier(s.code, sector, m.c), `set ${s.code} sector ${sector}/${m.c} no longer decodes`)
        assert.ok(
          !selectableModifiers(s.code, sector).some(x => x.c === m.c),
          `set ${s.code} sector ${sector}/${m.c} is still offered in the picker`
        )
      }
    }
  }
  assert.ok(disused > 150, `expected the withdrawn placeholders to be present, found ${disused}`)
  // Land Unit is the finding's own example: 29 withdrawn sector-2 modifiers.
  const land2 = getSet('10')!.m2
  assert.ok(land2.some(m => m.d === 1), 'Land Unit sector 2 should carry withdrawn codes')
  assert.equal(selectableModifiers('10', 2).filter(m => m.d).length, 0)
})

/* ------------------------------------------------------------------ lookup */

test('getSet / getEntity / getModifier resolve real codes and reject invented ones', () => {
  const land = getSet('10')
  assert.ok(land)
  assert.equal(land.code, '10')

  const infantry = getEntity('10', '121100')
  assert.ok(infantry, 'Land Unit 121100 (Infantry) must exist')
  assert.equal(infantry.n, 'Infantry')

  assert.equal(getSet('99'), undefined)
  assert.equal(getEntity('10', '999999'), undefined)
  assert.equal(getEntity('99', '121100'), undefined, 'a real entity code in a fake set must not resolve')
  assert.equal(getModifier('99', 1, '001'), undefined)

  // Sector lookups must not leak across sectors.
  const m1 = land.m1[0]
  assert.deepEqual(getModifier('10', 1, m1.c), m1)
  const sector2Codes = new Set(land.m2.map(m => m.c))
  if (!sector2Codes.has(m1.c)) {
    assert.equal(getModifier('10', 2, m1.c), undefined, 'sector 1 code must not resolve in sector 2')
  }
})

test('entityPath and entityLabel read outermost-first', () => {
  const infantry = getEntity('10', '121100')!
  const path = entityPath(infantry)
  assert.equal(path[path.length - 1], infantry.n, 'the leaf name is last')
  assert.deepEqual(path.slice(0, -1), infantry.p ?? [])
  assert.equal(entityLabel(infantry), path.join(' / '))

  // A top-level entity has no ancestors, so its label is just its name.
  const topLevel = symbolSets.flatMap(s => s.entities).find(e => (e.p ?? []).length === 0)!
  assert.equal(entityLabel(topLevel), topLevel.n)
})

/* -------------------------------------------------------------- hierarchy */

/**
 * The six-digit entity code is entity(2) + type(2) + subtype(2), so a code
 * whose subtype is non-zero should sit under the same code with the subtype
 * zeroed, and that in turn under the code with the type zeroed as well.
 */
function expectedAncestorCodes(code: string): string[] {
  const chain: string[] = []
  if (code.slice(4, 6) !== '00') chain.push(code.slice(0, 4) + '00')
  if (code.slice(2, 4) !== '00') chain.push(code.slice(0, 2) + '0000')
  return chain.reverse()
}

interface HierarchyException {
  setCode: string
  entity: CatalogEntity
  reason: string
}

function hierarchyExceptions(set: CatalogSet): HierarchyException[] {
  const byCode = new Map(set.entities.map(e => [e.c, e]))
  const out: HierarchyException[] = []
  for (const e of set.entities) {
    const expected = expectedAncestorCodes(e.c)
    const p = e.p ?? []
    if (expected.length > 0 && p.length === 0) {
      out.push({ setCode: set.code, entity: e, reason: `no ancestor path, expected ${expected.join(' > ')}` })
      continue
    }
    if (p.length !== expected.length) {
      out.push({ setCode: set.code, entity: e, reason: `path depth ${p.length}, code implies ${expected.length} (${expected.join(' > ')})` })
      continue
    }
    for (let i = 0; i < expected.length; i++) {
      const ancestor = byCode.get(expected[i])
      if (!ancestor) {
        out.push({ setCode: set.code, entity: e, reason: `ancestor code ${expected[i]} is not in the table` })
        break
      }
      if (ancestor.n !== p[i]) {
        out.push({ setCode: set.code, entity: e, reason: `ancestor ${expected[i]} is named "${ancestor.n}" but the path says "${p[i]}"` })
        break
      }
    }
  }
  return out
}

/**
 * The six entries the milstandard-e source tables genuinely skip a level on.
 * They are listed explicitly rather than tolerated by count, so a seventh — or
 * a different six — fails this test.
 */
const KNOWN_HIERARCHY_EXCEPTIONS: ReadonlyArray<readonly [string, string]> = [
  ['10', '170100'], // "Naval" carries no ancestor path although 170000 exists
  ['15', '120301'], // three "{Disused}" vehicles hang straight off "Vehicle"
  ['15', '120302'],
  ['15', '120303'],
  ['20', '120701'], // "Medical" hangs straight off "Infrastructure"
  ['20', '121202'], // "Telecommunications" likewise
]

test('entity hierarchies follow the code prefix structure', () => {
  const exceptions: HierarchyException[] = []
  const perSet: string[] = []
  for (const s of symbolSets) {
    const ex = hierarchyExceptions(s)
    exceptions.push(...ex)
    if (ex.length > 0) perSet.push(`  set ${s.code} ${s.name}: ${ex.length}/${s.entities.length}`)
  }

  console.log(`hierarchy: ${exceptions.length} exception(s) across ${catalogSize} entities`)
  if (perSet.length > 0) console.log(perSet.join('\n'))
  for (const e of exceptions) {
    console.log(`  ${e.setCode}/${e.entity.c} "${e.entity.n}" — ${e.reason}`)
  }

  // Every set that is currently coherent must stay coherent.
  const exceptionSets = new Set(KNOWN_HIERARCHY_EXCEPTIONS.map(([set]) => set))
  for (const s of symbolSets) {
    if (exceptionSets.has(s.code)) continue
    assert.deepEqual(
      hierarchyExceptions(s).map(e => e.entity.c), [],
      `set ${s.code} (${s.name}) is expected to have a fully coherent hierarchy`
    )
  }

  // And the sets that do skip levels must skip exactly the levels we know about.
  assert.deepEqual(
    exceptions.map(e => [e.setCode, e.entity.c]).sort(),
    KNOWN_HIERARCHY_EXCEPTIONS.map(x => [...x]).sort(),
    'the set of hierarchy exceptions changed — regenerate or update KNOWN_HIERARCHY_EXCEPTIONS'
  )
})

test('every ancestor code named by the prefix structure exists in its own table', () => {
  // Stricter than the path check above: independent of `p`, the intermediate
  // codes themselves must be selectable, or the UI's tree has holes.
  const missing: string[] = []
  for (const s of symbolSets) {
    const byCode = new Set(s.entities.map(e => e.c))
    for (const e of s.entities) {
      for (const a of expectedAncestorCodes(e.c)) {
        if (!byCode.has(a)) missing.push(`${s.code}/${e.c} "${e.n}" -> missing ${a}`)
      }
    }
  }
  assert.deepEqual(missing, [], 'entity codes must not point at absent ancestors')
})

/* ----------------------------------------------------------------- search */

const REAL_QUERIES = [
  'infantry', 'tank', 'medical', 'artillery',
  'submarine', 'checkpoint', 'bridge', 'helicopter',
]

test('searchEntities finds real symbols for real queries', () => {
  for (const q of REAL_QUERIES) {
    const hits = searchEntities(q)
    assert.ok(hits.length > 0, `"${q}" returned no hits`)
    for (const h of hits) {
      const haystack = `${h.setName} ${entityLabel(h.entity)}`.toLowerCase()
      assert.ok(haystack.includes(q), `"${q}" matched ${h.setCode}/${h.entity.c} "${h.entity.n}" which does not contain it`)
      assert.ok(getEntity(h.setCode, h.entity.c), `hit ${h.setCode}/${h.entity.c} is not in the catalogue`)
    }
  }
})

test('searchEntities ranks an exact leaf-name match first', () => {
  for (const q of REAL_QUERIES) {
    const exact = symbolSets.some(s => s.entities.some(e => e.n.toLowerCase() === q))
    if (!exact) continue
    const first = searchEntities(q)[0]
    assert.equal(first.entity.n.toLowerCase(), q, `"${q}" should rank its exact leaf match first, got "${first.entity.n}"`)
  }
  // Scores must be non-decreasing, i.e. the list really is ranked.
  const hits = searchEntities('air')
  for (let i = 1; i < hits.length; i++) {
    assert.ok(hits[i].score >= hits[i - 1].score, 'hits must come back in score order')
  }
})

test('searchEntities respects setCode', () => {
  const all = searchEntities('tank')
  const scoped = searchEntities('tank', { setCode: '15' })
  assert.ok(scoped.length > 0, 'expected Land Equipment tanks')
  assert.ok(scoped.length < all.length, 'scoping should narrow the result')
  for (const h of scoped) assert.equal(h.setCode, '15')
  assert.deepEqual(searchEntities('tank', { setCode: '99' }), [], 'an unknown set yields nothing')
})

test('searchEntities respects limit', () => {
  for (const limit of [1, 3, 7, 25]) {
    assert.ok(searchEntities('a', { limit }).length <= limit, `limit ${limit} exceeded`)
    assert.ok(searchEntities('', { limit }).length <= limit, `limit ${limit} exceeded on an empty query`)
    assert.ok(searchEntities('air', { setCode: '01', limit }).length <= limit, `limit ${limit} exceeded when scoped`)
  }
  assert.equal(searchEntities('infantry', { limit: 1 }).length, 1)
  // The default limit must not silently truncate below what the UI expects.
  assert.ok(searchEntities('a').length <= 200)
})

test('searchEntities requires every token to match', () => {
  assert.deepEqual(searchEntities('infantry zzzzzz'), [], 'one unmatched token must drop the hit')
  assert.ok(searchEntities('fighting vehicle').length > 0, 'multi-token queries must still match')
  assert.deepEqual(searchEntities('qqqqzzzz'), [], 'nonsense must return nothing, not everything')
})
