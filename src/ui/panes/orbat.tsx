import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import { EXAMPLE_ORBAT } from '../../core/orbat'
import { Accordion, Field, NumberInput } from '../components'
import { buildOrbat, type OrbatBuild } from '../orbat-payload'
import type { AppState } from '../store'

export interface OrbatSettings {
  text: string
  cellWidth: number
  cellHeight: number
  hGap: number
  vGap: number
  labelHeight: number
  labelFontSize: number
  symbolSize: number
  name: string
}

/** `.preview`'s own padding, in px; the chart is laid out inside it. */
const PREVIEW_PADDING = 14
/** Used for the very first paint, before the preview has been measured. */
const FALLBACK_PREVIEW_WIDTH = 404

export const DEFAULT_ORBAT: OrbatSettings = {
  text: EXAMPLE_ORBAT,
  cellWidth: 110,
  cellHeight: 76,
  hGap: 20,
  vGap: 52,
  labelHeight: 18,
  labelFontSize: 11,
  symbolSize: 38,
  name: 'ORBAT',
}

export function toOrbatOptions(s: OrbatSettings) {
  return {
    metrics: {
      cellWidth: s.cellWidth,
      cellHeight: s.cellHeight,
      hGap: s.hGap,
      vGap: s.vGap,
      labelHeight: s.labelHeight,
    },
    labelFontSize: s.labelFontSize,
    symbolSize: s.symbolSize,
    name: s.name,
  }
}

/**
 * One cell of the preview. The symbol is positioned on its octagon anchor so
 * that frames line up across the row exactly as they will on the canvas, rather
 * than drifting whenever an echelon mark or a headquarters staff changes the
 * symbol's bounding box.
 */
function SymbolCell(props: {
  markup: string
  anchor: { x: number; y: number } | null
  width: number
  height: number
}) {
  const style = props.anchor
    ? `position:absolute;left:${props.width / 2 - props.anchor.x}px;top:${props.height / 2 - props.anchor.y}px`
    : `position:absolute;left:0;top:0;width:${props.width}px;height:${props.height}px;display:flex;align-items:center;justify-content:center`
  return (
    <div style={`position:relative;width:${props.width}px;height:${props.height}px`}>
      <div style={style} dangerouslySetInnerHTML={{ __html: props.markup }} />
    </div>
  )
}

/** Build a whole order of battle from an indented outline. */
export function OrbatPane(props: {
  state: AppState
  settings: OrbatSettings
  onSettings: (patch: Partial<OrbatSettings>) => void
  onBuild: (build: OrbatBuild) => void
}) {
  const { settings } = props
  const [showHelp, setShowHelp] = useState(false)

  const build = useMemo(
    () => buildOrbat(settings.text, props.state, toOrbatOptions(settings)),
    [settings, props.state.sidc, props.state.style]
  )

  useEffect(() => { props.onBuild(build) }, [build])

  /**
   * The chart is drawn at its canvas size and scaled down to fit the preview,
   * so the scale has to come from the preview's real width — a plugin window
   * can be dragged to any size, and a hardcoded one either clips the chart or
   * strands it in the corner of a wide panel.
   */
  const previewRef = useRef<HTMLDivElement>(null)
  const [boxWidth, setBoxWidth] = useState(0)
  useEffect(() => {
    const el = previewRef.current
    if (!el) return
    // clientWidth includes the preview's own padding, which the chart cannot use.
    const measure = () => setBoxWidth(Math.max(0, el.clientWidth - PREVIEW_PADDING * 2))
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const avail = boxWidth > 0 ? boxWidth : FALLBACK_PREVIEW_WIDTH
  const scale = build.width > 0 ? Math.min(1, avail / build.width) : 1

  return (
    <div class="pane">
      <Field label="Outline" hint="Indent with spaces or tabs to nest subordinates">
        <textarea
          rows={10}
          spellcheck={false}
          value={settings.text}
          onInput={e => props.onSettings({ text: (e.currentTarget as HTMLTextAreaElement).value })}
        />
      </Field>

      <div class="spread">
        <span class="muted">
          {build.count} unit{build.count === 1 ? '' : 's'}
          {build.problems.length > 0 ? ` · ${build.problems.length} problem${build.problems.length === 1 ? '' : 's'}` : ''}
        </span>
        <div class="row">
          <button class="btn sm ghost" onClick={() => setShowHelp(v => !v)}>Syntax</button>
          <button class="btn sm ghost" onClick={() => props.onSettings({ text: EXAMPLE_ORBAT })}>Example</button>
        </div>
      </div>

      {showHelp && (
        <div class="banner">
          One unit per line. Indent to nest. After the name, add <code>|</code>-separated
          directives: an echelon (<code>bn</code>, <code>company</code>, <code>bde</code>),
          an affiliation (<code>hostile</code>, <code>neutral</code>), a six-digit entity code,
          <code> hq</code>, <code>tf</code>, or a full 30-digit SIDC. Anything not given is
          inherited from the parent; the Build tab's current symbol is the root default.
          Lines starting with <code>#</code> are ignored.
        </div>
      )}

      {build.problems.length > 0 && (
        <div class="banner warn">
          {build.problems.slice(0, 5).map(p => (
            <div key={p.line}>Line {p.line}: {p.message}</div>
          ))}
          {build.problems.length > 5 && <div>…and {build.problems.length - 5} more</div>}
        </div>
      )}

      <div
        ref={previewRef}
        class="preview"
        style={`min-height:120px;align-items:flex-start;justify-content:flex-start;overflow:auto;height:${Math.min(320, Math.max(120, build.height * scale + PREVIEW_PADDING * 2))}px`}
      >
        {build.count === 0 ? (
          <div class="empty">
            <div class="em-circle" aria-hidden="true">N</div>
            <h3>Nothing to draw yet</h3>
            <p>Write one unit per line above, indenting to nest subordinates.</p>
          </div>
        ) : (
          <div class="orbat-fit" style={`width:${build.width * scale}px;height:${build.height * scale}px`}>
            <div class="orbat-canvas" style={`position:relative;width:${build.width}px;height:${build.height}px;transform:scale(${scale});transform-origin:top left`}>
              <div
                style="position:absolute;inset:0"
                dangerouslySetInnerHTML={{ __html: build.connectorSvg }}
              />
              {build.placed.map((node, i) => (
                <div
                  key={node.id}
                  class="orbat-cell"
                  style={`position:absolute;left:${node.x}px;top:${node.y}px;width:${node.width}px;height:${node.height}px;display:flex;flex-direction:column;align-items:center;justify-content:flex-start`}
                  title={node.sidc}
                >
                  <SymbolCell
                    markup={build.previews[i] ?? ''}
                    anchor={build.anchors[i] ?? null}
                    width={node.width}
                    height={node.height - settings.labelHeight}
                  />
                  <div style={`font-size:${settings.labelFontSize}px;line-height:${settings.labelHeight}px;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%`}>
                    {node.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <Accordion title="Chart layout">
        <Field label="Chart name">
          <input
            type="text"
            value={settings.name}
            onInput={e => props.onSettings({ name: (e.currentTarget as HTMLInputElement).value })}
          />
        </Field>
        <div class="row">
          <Field label="Cell width" grow>
            <NumberInput value={settings.cellWidth} min={40} max={400} onChange={v => props.onSettings({ cellWidth: v })} />
          </Field>
          <Field label="Cell height" grow>
            <NumberInput value={settings.cellHeight} min={30} max={400} onChange={v => props.onSettings({ cellHeight: v })} />
          </Field>
        </div>
        <div class="row">
          <Field label="Gap across" grow>
            <NumberInput value={settings.hGap} min={0} max={200} onChange={v => props.onSettings({ hGap: v })} />
          </Field>
          <Field label="Gap down" grow>
            <NumberInput value={settings.vGap} min={0} max={300} onChange={v => props.onSettings({ vGap: v })} />
          </Field>
        </div>
        <div class="row">
          <Field label="Label strip" grow>
            <NumberInput value={settings.labelHeight} min={0} max={60} onChange={v => props.onSettings({ labelHeight: v })} />
          </Field>
          <Field label="Label size" grow>
            <NumberInput value={settings.labelFontSize} min={6} max={40} onChange={v => props.onSettings({ labelFontSize: v })} />
          </Field>
        </div>
        <Field label="Symbol size" hint="Frame height in px; every symbol in the chart uses the same one">
          <NumberInput value={settings.symbolSize} min={10} max={200} onChange={v => props.onSettings({ symbolSize: v })} />
        </Field>
      </Accordion>
    </div>
  )
}
