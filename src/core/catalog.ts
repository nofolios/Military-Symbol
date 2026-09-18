/**
 * The APP-6E entity / modifier catalogue, derived at build time from the
 * MIT-licensed `milstandard-e` tables (see build/build-catalog.mjs).
 */
import catalogJson from '../data/catalog.json'

export interface CatalogEntity {
  /** six-digit entity code (positions 11-16 of the SIDC) */
  c: string
  /** leaf name */
  n: string
  /** ancestor names, outermost first */
  p?: string[]
  /** remarks from the standard */
  r?: string
  /** control-measure geometric rendering hint (point / line / area) */
  g?: string
  /** 1 when the standard has withdrawn this code and kept it as a placeholder */
  d?: 1
}

export interface CatalogModifier {
  /** three-digit sector modifier code */
  c: string
  n: string
  cat?: string
  r?: string
  /** 1 when the entry comes from the shared "common modifiers" table */
  common?: number
  /** 1 when the standard has withdrawn this code and kept it as a placeholder */
  d?: 1
}

export interface CatalogSet {
  code: string
  name: string
  dimension: string
  group: string
  entities: CatalogEntity[]
  m1: CatalogModifier[]
  m2: CatalogModifier[]
}

export interface Catalog {
  standard: string
  source: string
  sets: CatalogSet[]
}

export const catalog = catalogJson as unknown as Catalog
export const symbolSets = catalog.sets
export const symbolSetCodes = new Set(symbolSets.map(s => s.code))

const setByCode = new Map(symbolSets.map(s => [s.code, s]))
export const getSet = (code: string): CatalogSet | undefined => setByCode.get(code)

const entityIndex = new Map<string, Map<string, CatalogEntity>>()
for (const s of symbolSets) entityIndex.set(s.code, new Map(s.entities.map(e => [e.c, e])))

export const getEntity = (setCode: string, entityCode: string): CatalogEntity | undefined =>
  entityIndex.get(setCode)?.get(entityCode)

export const getModifier = (setCode: string, sector: 1 | 2, code: string): CatalogModifier | undefined => {
  const s = setByCode.get(setCode)
  if (!s) return undefined
  return (sector === 1 ? s.m1 : s.m2).find(m => m.c === code)
}

/**
 * The sector modifiers a picker should offer: everything the symbol set defines
 * except the codes the standard has withdrawn, which would stamp an obsolete
 * glyph on an otherwise current symbol.
 */
export const selectableModifiers = (setCode: string, sector: 1 | 2): CatalogModifier[] => {
  const s = setByCode.get(setCode)
  if (!s) return []
  return (sector === 1 ? s.m1 : s.m2).filter(m => !m.d)
}

/** "Command and Control / Signal / Radio" */
export function entityPath(e: CatalogEntity): string[] {
  return [...(e.p ?? []), e.n]
}
export function entityLabel(e: CatalogEntity): string {
  return entityPath(e).join(' / ')
}

/* ------------------------------------------------------------------ search */

export interface SearchOptions {
  setCode?: string
  limit?: number
  /** include codes the standard has withdrawn; off by default */
  includeDisused?: boolean
}

export interface SearchHit {
  setCode: string
  setName: string
  entity: CatalogEntity
  /** lower is better */
  score: number
}

interface IndexRow {
  setCode: string
  setName: string
  entity: CatalogEntity
  /** lowercased "setname · path / leaf" used for matching */
  hay: string
  leaf: string
}

const index: IndexRow[] = []
for (const s of symbolSets) {
  for (const e of s.entities) {
    const path = entityPath(e).join(' / ')
    index.push({
      setCode: s.code,
      setName: s.name,
      entity: e,
      hay: `${s.name} ${path} ${e.c}`.toLowerCase(),
      leaf: e.n.toLowerCase(),
    })
  }
}

export const catalogSize = index.length
/** Entities a user can actually pick, i.e. excluding withdrawn placeholders. */
export const searchableCount = index.filter(r => !r.entity.d).length

/**
 * Small, dependency-free ranked search: all query tokens must appear, and hits
 * are ranked by where they matched (leaf name beats ancestor path) and by how
 * early in the leaf the first token lands.
 */
export function searchEntities(query: string, opts: SearchOptions = {}): SearchHit[] {
  const limit = opts.limit ?? 200
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean)
  const out: SearchHit[] = []

  for (const row of index) {
    if (opts.setCode && row.setCode !== opts.setCode) continue
    if (row.entity.d && !opts.includeDisused) continue
    if (tokens.length === 0) {
      out.push({ setCode: row.setCode, setName: row.setName, entity: row.entity, score: 500 })
      if (out.length >= limit && !opts.setCode) break
      continue
    }
    let score = 0
    let ok = true
    for (const t of tokens) {
      const inLeaf = row.leaf.indexOf(t)
      if (inLeaf === 0) { score += 0; continue }
      if (inLeaf > 0) { score += 10 + Math.min(inLeaf, 20); continue }
      const inHay = row.hay.indexOf(t)
      if (inHay >= 0) { score += 60; continue }
      ok = false
      break
    }
    if (!ok) continue
    // Prefer shorter, higher-level entries when scores tie.
    score += Math.min(row.leaf.length, 40) / 10
    score += (row.entity.p?.length ?? 0) * 2
    out.push({ setCode: row.setCode, setName: row.setName, entity: row.entity, score })
  }

  out.sort((a, b) => a.score - b.score || a.entity.c.localeCompare(b.entity.c))
  return out.slice(0, limit)
}
