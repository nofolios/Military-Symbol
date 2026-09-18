import { STANDARD_IDENTITIES, formatSidc, parseSidc, type Sidc } from '../../core/sidc'
import { Svg } from '../components'
import { renderSvg } from '../render'
import { describeSidc, type AppState } from '../store'
import type { SelectedSymbolInfo } from '../../shared/messages'

/** Work with symbols already on the canvas. */
export function SelectionPane(props: {
  state: AppState
  selection: SelectedSymbolInfo[]
  /** how many nodes are selected on the canvas, which may exceed `selection` */
  total: number
  onOpenInBuilder: (sidc: Sidc, amplifiers: Record<string, string>) => void
  onRestyle: () => void
  onSetAffiliation: (code: string) => void
}) {
  const ours = props.selection.filter(s => s.spec)
  const others = props.selection.length - ours.length

  return (
    <div class="pane">
      {props.selection.length === 0 && (
        <div class="empty">
          <div class="em-circle" aria-hidden="true">□</div>
          <h3>Nothing selected</h3>
          <p>Select symbols on the canvas to restyle them, change their affiliation, or load one back into the builder.</p>
        </div>
      )}

      {props.selection.length > 0 && (
        <div class="banner">
          {ours.length} plugin symbol{ours.length === 1 ? '' : 's'} selected
          {others > 0 ? ` · ${others} other node${others === 1 ? '' : 's'} ignored` : ''}
          {props.total > props.selection.length
            ? ` · showing the first ${props.selection.length} of ${props.total} selected nodes`
            : ''}
        </div>
      )}

      {ours.length > 0 && (
        <>
          <div class="section">
            <h3>Change affiliation</h3>
            <div class="chips">
              {STANDARD_IDENTITIES.map(si => (
                <button key={si.code} class="chip" onClick={() => props.onSetAffiliation(si.code)}>
                  {si.label}
                </button>
              ))}
            </div>
          </div>

          <div class="section">
            <h3>Restyle</h3>
            <button class="btn" onClick={props.onRestyle}>
              Re-render {ours.length} symbol{ours.length === 1 ? '' : 's'} with the current style
            </button>
            <span class="muted">
              Replaces each node in place, keeping its position, size and place in the layer tree.
            </span>
          </div>

          <div class="section">
            <h3>Selected symbols</h3>
            <div class="results">
              {ours.map(item => {
                const spec = item.spec!
                const sidc = parseSidc(spec.sidc)
                return (
                  <button
                    key={item.nodeId}
                    type="button"
                    class="result"
                    title={`${spec.sidc}\nClick to load into the builder`}
                    onClick={() => props.onOpenInBuilder(sidc, toStringMap(spec.amplifiers))}
                  >
                    <Svg class="thumb" markup={thumb(spec.sidc, props.state)} />
                    <span class="name">
                      <b>{describeSidc(sidc)}</b>
                      <span class="path mono">{formatSidc(sidc)}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

const toStringMap = (m: Record<string, string | number>): Record<string, string> => {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(m ?? {})) out[k] = String(v)
  return out
}

function thumb(sidc: string, state: AppState): string {
  try {
    return renderSvg({ sidc, amplifiers: {}, style: { ...state.style, size: 18, infoFields: false }, label: '' })
  } catch {
    return ''
  }
}
