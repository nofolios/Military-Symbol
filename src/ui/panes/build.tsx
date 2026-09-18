import { useMemo, useState, useRef, useEffect } from 'preact/hooks'
import {
  CONTEXTS, FRAME_SHAPES, HQTFD, STANDARD_IDENTITIES, STATUSES,
  amplifierLabel, amplifiersForSet, cleanSidcInput, formatSidc, parseSidc, validateSidc, type Sidc,
} from '../../core/sidc'
import {
  entityLabel, entityPath, getEntity, getModifier, getSet, searchEntities, selectableModifiers,
  symbolSetCodes, symbolSets,
} from '../../core/catalog'
import { Accordion, Field, NumberInput, Select, type Option } from '../components'
import { AMPLIFIER_FIELDS } from '../render'
import { Preview } from '../preview'
import { PresetPicker } from './presets'
import type { AppState } from '../store'
import { changeSymbolSet, describeSidc } from '../store'

const setOptions: Option[] = symbolSets.map(s => ({
  value: s.code,
  label: `${s.code} · ${s.name}`,
  group: s.group,
}))

const opts = (list: ReadonlyArray<{ code: string; label: string; group?: string }>): Option[] =>
  list.map(x => ({ value: x.code, label: x.label, group: x.group }))

export function BuildPane(props: {
  state: AppState
  patchSidc: (p: Partial<Sidc>) => void
  setAmplifier: (key: string, value: string) => void
  onToggleFavourite: () => void
  onCopySvg: () => void
  onCopySidc: () => void
}) {
  const { state, patchSidc } = props
  const s = state.sidc
  const set = getSet(s.symbolSet)
  const entity = getEntity(s.symbolSet, s.entity)
  const sidcString = formatSidc(s)

  const problems = useMemo(() => validateSidc(s, symbolSetCodes), [sidcString])
  const errors = problems.filter(p => p.severity === 'error')

  /**
   * Only the amplifiers APP-6E allows on this symbol set. A code already in the
   * SIDC is kept, marked, so that pasting an old or hand-written symbol does not
   * leave the control showing something it is not.
   */
  const amplifierOptions = useMemo<Option[]>(() => {
    const allowed = amplifiersForSet(s.symbolSet)
    const options = opts(allowed)
    if (!allowed.some(a => a.code === s.amplifier)) {
      options.push({
        value: s.amplifier,
        label: `${s.amplifier} · ${amplifierLabel(s.amplifier)}`,
        group: 'Not used on this symbol set',
      })
    }
    return options
  }, [s.symbolSet, s.amplifier])
  /**
   * Withdrawn modifier codes are left out: picking one would stamp an obsolete
   * glyph. A code already present in the SIDC is kept in the list so that
   * pasting an old symbol does not leave the control showing nothing.
   */
  const modifierOptions = (sector: 1 | 2, current: string): Option[] => {
    const available = selectableModifiers(s.symbolSet, sector)
    const options: Option[] = [{ value: '000', label: 'None' }]
    for (const m of available) options.push({ value: m.c, label: `${m.c} · ${m.n}`, group: m.cat })
    if (current !== '000' && !available.some(m => m.c === current)) {
      const known = getModifier(s.symbolSet, sector, current)
      options.push({
        value: current,
        label: known ? `${current} · ${known.n} (withdrawn)` : `${current} · not in this symbol set`,
        group: 'From the pasted code',
      })
    }
    return options
  }
  const modifier1Options = useMemo<Option[]>(
    () => modifierOptions(1, s.modifier1),
    [s.symbolSet, s.modifier1]
  )
  const modifier2Options = useMemo<Option[]>(
    () => modifierOptions(2, s.modifier2),
    [s.symbolSet, s.modifier2]
  )

  const isFavourite = state.favourites.includes(sidcString)

  return (
    <div class="pane">
      <Preview state={state} sidc={s} />

      <SidcStrip
        sidc={sidcString}
        onChange={next => patchSidc(parseSidc(next))}
        favourite={isFavourite}
        onToggleFavourite={props.onToggleFavourite}
        onCopySvg={props.onCopySvg}
        onCopySidc={props.onCopySidc}
      />

      <Accordion title="Start from a preset">
        <PresetPicker state={state} onPick={sidc => patchSidc(sidc)} />
      </Accordion>

      {errors.length > 0 && (
        <div class="banner error">{errors.map(e => e.message).join(' · ')}</div>
      )}

      <div class="section">
        <h3>Identity</h3>
        <div class="row">
          <Field label="Symbol set" grow>
            <Select
              value={s.symbolSet}
              options={setOptions}
              onChange={v => patchSidc(changeSymbolSet(s, v))}
            />
          </Field>
          <Field label="Affiliation" grow>
            <Select value={s.standardIdentity} options={opts(STANDARD_IDENTITIES)} onChange={v => patchSidc({ standardIdentity: v })} />
          </Field>
        </div>
        <div class="row">
          <Field label="Context" grow>
            <Select value={s.context} options={opts(CONTEXTS)} onChange={v => patchSidc({ context: v })} />
          </Field>
          <Field label="Status" grow>
            <Select value={s.status} options={opts(STATUSES)} onChange={v => patchSidc({ status: v })} />
          </Field>
        </div>
      </div>

      <div class="section">
        <h3>Entity</h3>
        <EntityPicker
          symbolSet={s.symbolSet}
          entityCode={s.entity}
          onPick={(setCode, code) => patchSidc(setCode === s.symbolSet ? { entity: code } : { symbolSet: setCode, entity: code, modifier1: '000', modifier2: '000' })}
        />
        {entity && (
          <div class="spread">
            <span class="muted" title={entityLabel(entity)}>{entityPath(entity).join(' › ')}</span>
            <button class="btn ghost sm" onClick={() => patchSidc({ entity: '000000' })}>Clear</button>
          </div>
        )}
        {entity?.r && <div class="banner">{entity.r}</div>}
      </div>

      <div class="section">
        <h3>Modifiers</h3>
        <Field label="Sector 1 modifier">
          <Select value={s.modifier1} options={modifier1Options} onChange={v => patchSidc({ modifier1: v })} />
        </Field>
        <Field label="Sector 2 modifier">
          <Select value={s.modifier2} options={modifier2Options} onChange={v => patchSidc({ modifier2: v })} />
        </Field>
      </div>

      <div class="section">
        <h3>Amplifiers</h3>
        <div class="row">
          <Field
            label="Echelon / mobility"
            grow
            hint="SIDC positions 9-10. Only the amplifiers APP-6E allows on this symbol set are offered."
          >
            <Select value={s.amplifier} options={amplifierOptions} onChange={v => patchSidc({ amplifier: v })} />
          </Field>
        </div>
        <div class="row">
          <Field label="HQ / task force / dummy" grow>
            <Select value={s.hqtfd} options={opts(HQTFD)} onChange={v => patchSidc({ hqtfd: v })} />
          </Field>
        </div>
        {/* Its own row: a <select> cannot ellipsize, and several frame-shape
            labels are wider than half a 460px panel. */}
        <div class="row">
          <Field label="Frame shape" grow hint="Overrides the frame implied by the symbol set">
            <Select value={s.frameShape} options={opts(FRAME_SHAPES)} onChange={v => patchSidc({ frameShape: v })} />
          </Field>
        </div>
      </div>

      <Accordion
        title="Text amplifier fields"
        badge={String(Object.values(state.amplifiers).filter(Boolean).length || '')}
      >
        {AMPLIFIER_FIELDS.map(f => (
          <Field key={f.key} label={`${f.field} — ${f.label}`} hint={f.hint}>
            {'numeric' in f && f.numeric ? (
              <NumberInput
                value={Number(state.amplifiers[f.key] ?? 0)}
                min={0}
                max={360}
                onChange={v => props.setAmplifier(f.key, String(v))}
              />
            ) : (
              <input
                type="text"
                value={state.amplifiers[f.key] ?? ''}
                placeholder={f.hint}
                onInput={e => props.setAmplifier(f.key, (e.currentTarget as HTMLInputElement).value)}
              />
            )}
          </Field>
        ))}
      </Accordion>
    </div>
  )
}

/* ------------------------------------------------------------- SIDC strip */

function SidcStrip(props: {
  sidc: string
  onChange: (v: string) => void
  favourite: boolean
  onToggleFavourite: () => void
  onCopySvg: () => void
  onCopySidc: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(props.sidc)
  useEffect(() => { if (!editing) setDraft(props.sidc) }, [props.sidc, editing])

  const commit = () => {
    setEditing(false)
    const cleaned = cleanSidcInput(draft)
    if (cleaned.length >= 10) props.onChange(cleaned)
    else setDraft(props.sidc)
  }

  return (
    <div class="row" style="align-items:center">
      {editing ? (
        <input
          class="mono grow"
          value={draft}
          autoFocus
          spellcheck={false}
          onInput={e => setDraft((e.currentTarget as HTMLInputElement).value)}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === 'Enter') commit()
            if (e.key === 'Escape') { setDraft(props.sidc); setEditing(false) }
          }}
        />
      ) : (
        <button
          class="btn ghost grow mono"
          style="justify-content:flex-start;text-align:left;letter-spacing:.06em"
          title="Click to edit the SIDC directly"
          onClick={() => setEditing(true)}
        >
          {props.sidc}
        </button>
      )}
      <button
        class="btn sm"
        title={props.favourite ? 'Remove from favourites' : 'Add to favourites'}
        onClick={props.onToggleFavourite}
      >
        {props.favourite ? '★' : '☆'}
      </button>
      <button class="btn sm" title="Copy the 30-digit SIDC" onClick={props.onCopySidc}>
        SIDC
      </button>
      <button class="btn sm" title="Copy the symbol as SVG" onClick={props.onCopySvg}>
        SVG
      </button>
    </div>
  )
}

/* ----------------------------------------------------------- entity picker */

function EntityPicker(props: {
  symbolSet: string
  entityCode: string
  onPick: (setCode: string, entityCode: string) => void
}) {
  const [query, setQuery] = useState('')
  const [allSets, setAllSets] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const hits = useMemo(
    () => searchEntities(query, { setCode: allSets ? undefined : props.symbolSet, limit: 300 }),
    [query, props.symbolSet, allSets]
  )

  const current = getEntity(props.symbolSet, props.entityCode)

  return (
    <>
      <div class="row">
        <input
          ref={inputRef}
          class="grow"
          type="search"
          placeholder={allSets ? 'Search all symbol sets…' : `Search ${getSet(props.symbolSet)?.name ?? ''}…`}
          value={query}
          onInput={e => setQuery((e.currentTarget as HTMLInputElement).value)}
        />
        <button
          class="chip"
          aria-pressed={allSets}
          title="Search across every symbol set"
          onClick={() => setAllSets(v => !v)}
          style="height:var(--row);flex:none;white-space:nowrap"
        >
          All sets
        </button>
      </div>
      <div class="results">
        {hits.length === 0 && <div class="empty">No entity matches “{query}”.</div>}
        {hits.map(h => {
          const selected = h.entity.c === props.entityCode && h.setCode === props.symbolSet
          const ancestors = h.entity.p ?? []
          return (
            <button
              key={`${h.setCode}:${h.entity.c}`}
              type="button"
              class="result"
              aria-pressed={selected}
              onClick={() => props.onPick(h.setCode, h.entity.c)}
              title={`${h.setName} · ${entityLabel(h.entity)}`}
            >
              <span class="name">
                <b>{h.entity.n}</b>
                <span class="path">
                  {allSets ? `${h.setName} · ` : ''}
                  {ancestors.join(' › ') || '—'}
                  {h.entity.g && h.entity.g !== 'Point' ? ` · ${h.entity.g.toLowerCase()} graphic` : ''}
                </span>
              </span>
              <span class="code">{h.entity.c}</span>
            </button>
          )
        })}
      </div>
      {current && <div class="muted">Selected: {describeSidcEntity(current.n, props.entityCode)}</div>}
    </>
  )
}

const describeSidcEntity = (name: string, code: string) => `${name} (${code})`
export { describeSidc }
