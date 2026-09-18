import { useEffect, useMemo, useState } from 'preact/hooks'
import {
  AMPLIFIERS, STANDARD_IDENTITIES, STATUSES, formatSidc, parseSidc, type Sidc,
} from '../../core/sidc'
import { searchEntities, symbolSets } from '../../core/catalog'
import { Field, Select, Svg, type Option } from '../components'
import { renderSvg } from '../render'
import { layerName, type AppState } from '../store'
import {
  NO_POINT_SYMBOL, checkBatchItems, echelonLadder, parsePasted, type BatchItem,
} from '../batch-items'

export type { BatchItem }

type Generator = 'paste' | 'affiliations' | 'echelons' | 'statuses' | 'set-sheet' | 'favourites' | 'recents'

const GENERATORS: Option[] = [
  { value: 'paste', label: 'Paste SIDC list' },
  { value: 'affiliations', label: 'Affiliation series (current symbol)' },
  { value: 'echelons', label: 'Echelon ladder (current symbol)' },
  { value: 'statuses', label: 'Status series (current symbol)' },
  { value: 'set-sheet', label: 'Whole symbol set sheet' },
  { value: 'favourites', label: 'Favourites' },
  { value: 'recents', label: 'Recently inserted' },
]

const SET_OPTIONS: Option[] = symbolSets.map(s => ({ value: s.code, label: `${s.code} · ${s.name}`, group: s.group }))
const PREVIEW_CAP = 200

/** Bulk generation: paste a list, or expand the current symbol along one axis. */
export function BatchPane(props: {
  state: AppState
  items: BatchItem[]
  onItemsChange: (items: BatchItem[]) => void
}) {
  const [generator, setGenerator] = useState<Generator>('paste')
  const [text, setText] = useState('')
  const [sheetSet, setSheetSet] = useState(props.state.sidc.symbolSet)

  const base = props.state.sidc
  const baseKey = formatSidc(base)

  const generated = useMemo<BatchItem[]>(() => {
    const mk = (s: Sidc, label: string): BatchItem => ({ sidc: formatSidc(s), label })
    switch (generator) {
      case 'paste':
        return parsePasted(text)
      case 'affiliations':
        return STANDARD_IDENTITIES.map(si => mk({ ...base, standardIdentity: si.code }, si.label))
      case 'echelons':
        return ['00', ...echelonLadder(base.symbolSet)].map(code =>
          mk({ ...base, amplifier: code }, AMPLIFIERS.find(a => a.code === code)?.label ?? 'None')
        )
      case 'statuses':
        return STATUSES.map(st => mk({ ...base, status: st.code }, st.label))
      case 'set-sheet':
        // A reference sheet of a whole symbol set shows the entities, so the
        // builder's echelon, status and HQ flag are dropped; carrying them over
        // would put a platoon bar on all 93 ship types.
        return searchEntities('', { setCode: sheetSet, limit: 4000 }).map(h =>
          mk(
            {
              ...base,
              symbolSet: sheetSet,
              entity: h.entity.c,
              amplifier: '00',
              hqtfd: '0',
              status: '0',
              modifier1: '000',
              modifier2: '000',
            },
            h.entity.n
          )
        )
      case 'favourites':
        return props.state.favourites.map(s => ({ sidc: s, label: layerName(parseSidc(s)) }))
      case 'recents':
        return props.state.recents.map(s => ({ sidc: s, label: layerName(parseSidc(s)) }))
    }
  }, [generator, text, baseKey, sheetSet, props.state.favourites, props.state.recents])

  // Structurally broken codes and codes with no point symbol both stay in the
  // list, greyed out, so the user can see which line was wrong; neither is ever
  // handed to the sandbox.
  const checked = useMemo<BatchItem[]>(
    () => checkBatchItems(generated, props.state.style.standard),
    [generated, props.state.style.standard]
  )
  const usable = useMemo(() => checked.filter(i => !i.problem), [checked])
  const withoutSymbol = checked.filter(i => i.problem === NO_POINT_SYMBOL).length
  const rejected = checked.length - usable.length - withoutSymbol

  // Publish upward so the footer's Insert button acts on this list. The key
  // includes the labels, because switching generator can produce the same codes
  // under different names and the layer names must follow.
  const signature = usable.map(g => g.sidc + '\u0001' + g.label).join('|')
  useEffect(() => { props.onItemsChange(usable) }, [signature])

  return (
    <div class="pane">
      <Field label="Source">
        <Select value={generator} options={GENERATORS} onChange={v => setGenerator(v as Generator)} />
      </Field>

      {generator === 'paste' && (
        <Field label="One SIDC per line" hint="Optionally add a label after a comma, tab or pipe">
          <textarea
            rows={8}
            spellcheck={false}
            placeholder={'140310001211000000000000000000, Infantry platoon\n140310001611000000000000000000\n140315000013010000000000000000 | Main battle tank'}
            value={text}
            onInput={e => setText((e.currentTarget as HTMLTextAreaElement).value)}
          />
        </Field>
      )}

      {generator === 'set-sheet' && (
        <Field label="Symbol set">
          <Select value={sheetSet} options={SET_OPTIONS} onChange={setSheetSet} />
        </Field>
      )}

      {(generator === 'favourites' || generator === 'recents') && generated.length === 0 && (
        <div class="banner">Nothing here yet. Star symbols in the Build tab to collect favourites.</div>
      )}

      <div class="spread">
        <span class="muted">{usable.length} symbol{usable.length === 1 ? '' : 's'}</span>
        {generator === 'paste' && text.trim() !== '' && checked.length === 0 && (
          <span class="pill warn">No usable SIDC found</span>
        )}
        {rejected > 0 && (
          <span
            class="pill warn"
            title={checked.filter(i => i.problem && i.problem !== NO_POINT_SYMBOL).map(i => `${i.sidc}: ${i.problem}`).join('\n')}
          >
            {rejected} rejected
          </span>
        )}
        {withoutSymbol > 0 && (
          <span class="pill danger" title="APP-6E defines no point symbol for these codes: the renderer would draw its question mark, so they are left out of the insert.">
            {withoutSymbol} with no symbol
          </span>
        )}
      </div>

      <div class="gallery">
        {checked.slice(0, PREVIEW_CAP).map((item, i) => (
          <div
            key={item.sidc + ':' + i}
            class={item.problem ? 'cell rejected' : 'cell'}
            title={item.problem ? `${item.sidc}\n${item.problem}` : `${item.label} · ${item.sidc}`}
          >
            <Svg class="thumb" markup={item.problem ? '' : safeRender(item.sidc, props.state)} />
            <span class="label">
              {!item.problem ? item.label : item.problem === NO_POINT_SYMBOL ? 'no point symbol' : 'invalid code'}
            </span>
          </div>
        ))}
      </div>
      {checked.length > PREVIEW_CAP && (
        <div class="muted">Showing the first {PREVIEW_CAP} of {checked.length}. Inserting uses the whole list.</div>
      )}
    </div>
  )
}

function safeRender(sidc: string, state: AppState): string {
  try {
    return renderSvg({ sidc, amplifiers: {}, style: { ...state.style, size: 26, infoFields: false }, label: '' })
  } catch {
    return ''
  }
}
