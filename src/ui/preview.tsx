import { useMemo } from 'preact/hooks'
import type { Sidc } from '../core/sidc'
import { formatSidc } from '../core/sidc'
import { getEntity } from '../core/catalog'
import { Svg } from './components'
import { isDrawable, render } from './render'
import { buildSpec, describeSidc, type AppState } from './store'

/** Live preview of the symbol currently being built. */
export function Preview(props: { state: AppState; sidc: Sidc }) {
  const spec = useMemo(
    () => buildSpec(props.state, props.sidc),
    [formatSidc(props.sidc), JSON.stringify(props.state.amplifiers), JSON.stringify(props.state.style)]
  )

  const result = useMemo(() => {
    try {
      return { ok: true as const, value: render(spec) }
    } catch (e) {
      return { ok: false as const, message: e instanceof Error ? e.message : String(e) }
    }
  }, [JSON.stringify(spec)])

  if (!result.ok) {
    return <div class="preview"><div class="banner error">Could not render: {result.message}</div></div>
  }

  const { value } = result
  // Most of symbol set 25 is drawn as a line, an area or a corridor on the map.
  // Those have no point symbol at all, so the preview would otherwise show an
  // empty box with no explanation.
  const entity = getEntity(props.sidc.symbolSet, props.sidc.entity)
  const geometry = entity?.g
  const notAPoint = Boolean(geometry && geometry !== 'Point')
  // `valid` is milsymbol's own verdict and `undefinedIcon` is the question mark
  // it drew; both mean the same thing to a user, and both block the insert.
  const drawable = isDrawable(value)

  return (
    <div class="preview">
      <Svg markup={value.svg} />
      <div class="badge">
        {!drawable && (
          <span class="pill danger" title="APP-6E defines no point symbol for this code, so the renderer draws its question-mark glyph instead. Insertion is blocked rather than putting that on the canvas.">
            cannot be drawn
          </span>
        )}
        {drawable && notAPoint && (
          <span class="pill warn" title={`APP-6E renders this control measure as a ${String(geometry).toLowerCase()} on the map. This plugin inserts point symbols only.`}>
            {String(geometry).toLowerCase()} graphic
          </span>
        )}
        {drawable && !notAPoint && !value.hasIcon && (
          <span class="pill warn" title="This code resolves to a bare frame — APP-6E defines no icon geometry for it, or milsymbol does not draw one.">
            frame only
          </span>
        )}
      </div>
      <div class="sidc-strip">
        <span class="muted">{describeSidc(props.sidc)}</span>
      </div>
    </div>
  )
}
