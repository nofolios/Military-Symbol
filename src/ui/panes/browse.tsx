import { useEffect, useMemo, useState } from 'preact/hooks'
import { formatSidc, STANDARD_IDENTITIES, type Sidc } from '../../core/sidc'
import { entityLabel, getSet, searchEntities, symbolSets } from '../../core/catalog'
import { Field, Select, Svg, Toggle, type Option } from '../components'
import { hasIconGeometry, hasUndefinedIcon, renderSvg } from '../render'
import { rebaseSelection, type AppState } from '../store'

const setOptions: Option[] = symbolSets.map(s => ({ value: s.code, label: `${s.code} · ${s.name}`, group: s.group }))
const PAGE = 120

/** Browse a symbol set as a thumbnail sheet and pick several symbols at once. */
export function BrowsePane(props: {
  state: AppState
  selected: string[]
  onSelectedChange: (next: string[]) => void
  /** load a symbol into the Build tab */
  onOpenInBuilder: (sidc: Sidc) => void
  /** change the affiliation without leaving this tab */
  onAffiliationChange: (code: string) => void
}) {
  const [setCode, setSetCode] = useState(props.state.sidc.symbolSet)
  const [query, setQuery] = useState('')
  const [hideFrameOnly, setHideFrameOnly] = useState(true)
  const [matchBuilder, setMatchBuilder] = useState(false)
  const [limit, setLimit] = useState(PAGE)

  /**
   * Thumbnails must show exactly what will be inserted. Affiliation always
   * follows the builder because it is the thing users flip while browsing;
   * echelon, status and the HQ flag are left off unless asked for, since a
   * whole sheet wearing one unit's echelon is more confusing than helpful.
   */
  const base: Sidc = matchBuilder
    ? { ...props.state.sidc, symbolSet: setCode, modifier1: '000', modifier2: '000' }
    : {
        ...props.state.sidc,
        symbolSet: setCode,
        amplifier: '00',
        hqtfd: '0',
        status: '0',
        modifier1: '000',
        modifier2: '000',
      }
  const baseKey = formatSidc(base)

  const hits = useMemo(() => searchEntities(query, { setCode, limit: 4000 }), [query, setCode])

  const cells = useMemo(() => {
    const out: { sidc: string; label: string; title: string; svg: string }[] = []
    let hidden = 0
    for (const h of hits) {
      const code = formatSidc({ ...base, entity: h.entity.c })
      if (
        hideFrameOnly &&
        h.entity.c !== '000000' &&
        (!hasIconGeometry(code, props.state.style.standard) ||
          hasUndefinedIcon(code, props.state.style.standard))
      ) {
        hidden++
        continue
      }
      let svg = ''
      try {
        svg = renderSvg({
          sidc: code,
          amplifiers: {},
          style: { ...props.state.style, size: 26, infoFields: false },
          label: h.entity.n,
        })
      } catch {
        svg = ''
      }
      out.push({ sidc: code, label: h.entity.n, title: `${h.setName} · ${entityLabel(h.entity)} · ${h.entity.c}`, svg })
      if (out.length >= limit) break
    }
    return { out, hidden }
  }, [hits, limit, baseKey, hideFrameOnly, props.state.style])

  const shown = cells.out
  const total = hits.length

  /**
   * Selections are full SIDCs, but the cells are rebuilt from `base` on every
   * render, so anything the builder changes underneath them — affiliation,
   * status, the "Match builder" toggle — would otherwise leave them matching no
   * cell at all: invisible, still counted, and inserted with the old identity.
   * Moving them onto the current base keeps the highlights, the counter and
   * what actually gets inserted telling the same story.
   */
  const rebased = useMemo(() => rebaseSelection(props.selected, base), [props.selected, baseKey])

  const changed = rebased.length !== props.selected.length || rebased.some((c, i) => c !== props.selected[i])
  useEffect(() => {
    if (changed) props.onSelectedChange(rebased)
  }, [rebased.join('|')])

  const toggle = (sidc: string) => {
    props.onSelectedChange(rebased.includes(sidc) ? rebased.filter(s => s !== sidc) : [...rebased, sidc])
  }

  return (
    <div class="pane">
      <div class="row">
        <Field label="Symbol set" grow>
          <Select
            value={setCode}
            options={setOptions}
            onChange={v => { setSetCode(v); setLimit(PAGE) }}
          />
        </Field>
        <Field label="Affiliation" grow>
          <Select
            value={props.state.sidc.standardIdentity}
            options={STANDARD_IDENTITIES.map(x => ({ value: x.code, label: x.label }))}
            onChange={props.onAffiliationChange}
          />
        </Field>
      </div>

      <input
        type="search"
        placeholder={`Filter ${getSet(setCode)?.name ?? ''}…`}
        value={query}
        onInput={e => { setQuery((e.currentTarget as HTMLInputElement).value); setLimit(PAGE) }}
      />

      <div class="row">
        <Toggle
          label="Hide codes with no icon"
          title="Hides hierarchy placeholders that draw a bare frame, and codes with no point symbol at all"
          checked={hideFrameOnly}
          onChange={setHideFrameOnly}
        />
        <Toggle
          label="Match builder"
          title="Apply the builder's echelon, status and HQ flag to every thumbnail"
          checked={matchBuilder}
          onChange={setMatchBuilder}
        />
      </div>

      <div class="spread">
        <span class="muted">
          {total} entit{total === 1 ? 'y' : 'ies'}
          {cells.hidden > 0 ? ` · ${cells.hidden} without a point symbol hidden` : ''}
          {rebased.length > 0 ? ` · ${rebased.length} selected` : ''}
        </span>
        <div class="row">
          <button class="btn sm ghost" onClick={() => props.onSelectedChange(shown.map(c => c.sidc))}>Select page</button>
          <button class="btn sm ghost" disabled={rebased.length === 0} onClick={() => props.onSelectedChange([])}>Clear</button>
        </div>
      </div>

      <div class="gallery">
        {shown.map(c => (
          <button
            key={c.sidc}
            type="button"
            class="cell"
            aria-pressed={rebased.includes(c.sidc)}
            title={c.title}
            onClick={e => {
              if ((e as MouseEvent).altKey) props.onOpenInBuilder({ ...base, entity: c.sidc.slice(10, 16) })
              else toggle(c.sidc)
            }}
          >
            <Svg class="thumb" markup={c.svg} />
            <span class="label">{c.label}</span>
          </button>
        ))}
      </div>

      {shown.length === 0 && <div class="empty">Nothing to show here.</div>}

      {shown.length >= limit && (
        <button class="btn" onClick={() => setLimit(l => l + PAGE)}>Show more</button>
      )}

      <div class="muted">Click to select · Alt-click to open in the builder</div>
    </div>
  )
}
