import { useMemo, useState } from 'preact/hooks'
import { PRESETS, PRESET_CATEGORIES, searchPresets, type Preset } from '../../data/presets'
import { parseSidc, type Sidc } from '../../core/sidc'
import { Svg } from '../components'
import { renderSvg } from '../render'
import type { AppState } from '../store'

const PAGE = 60

/**
 * A curated shelf of ready-made symbols. Every entry here was verified to
 * render real icon geometry, so it is the fastest safe way into the catalogue
 * for someone who does not yet know the codes.
 */
export function PresetPicker(props: {
  state: AppState
  onPick: (sidc: Sidc, label: string) => void
}) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string | null>(null)
  const [limit, setLimit] = useState(PAGE)

  const hits = useMemo(() => {
    const base = query.trim() ? searchPresets(query) : PRESETS
    return category ? base.filter(p => p.category === category) : base
  }, [query, category])

  const shown = hits.slice(0, limit)

  return (
    <>
      <div class="row">
        <input
          class="grow"
          type="search"
          placeholder={`Search ${PRESETS.length} ready-made symbols…`}
          value={query}
          onInput={e => {
            setQuery((e.currentTarget as HTMLInputElement).value)
            setLimit(PAGE)
          }}
        />
      </div>

      <div class="chips">
        <button class="chip" aria-pressed={category === null} onClick={() => { setCategory(null); setLimit(PAGE) }}>
          All
        </button>
        {PRESET_CATEGORIES.map(c => (
          <button key={c} class="chip" aria-pressed={category === c} onClick={() => { setCategory(c); setLimit(PAGE) }}>
            {c}
          </button>
        ))}
      </div>

      {shown.length === 0 && <div class="empty">No preset matches “{query}”.</div>}

      <div class="gallery">
        {shown.map(p => (
          <button
            key={p.sidc}
            type="button"
            class="cell"
            title={`${p.label}\n${p.category}\n${p.sidc}`}
            onClick={() => props.onPick(parseSidc(p.sidc), p.label)}
          >
            <Svg class="thumb" markup={thumb(p, props.state)} />
            <span class="label">{p.label}</span>
          </button>
        ))}
      </div>

      {shown.length < hits.length && (
        <button class="btn" onClick={() => setLimit(l => l + PAGE)}>
          Show {Math.min(PAGE, hits.length - shown.length)} more of {hits.length}
        </button>
      )}
    </>
  )
}

function thumb(p: Preset, state: AppState): string {
  try {
    return renderSvg({
      sidc: p.sidc,
      amplifiers: {},
      style: { ...state.style, size: 26, infoFields: false },
      label: p.label,
    })
  } catch {
    return ''
  }
}
