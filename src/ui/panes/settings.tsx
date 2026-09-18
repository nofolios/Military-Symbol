import { Accordion, Field, NumberInput, Select, Toggle, type Option } from '../components'
import type { ColorModeName, InsertOptions, LayoutMode, SymbolStyle } from '../../shared/messages'
import { catalog, catalogSize, searchableCount } from '../../core/catalog'

const COLOR_MODES: Option[] = [
  { value: 'Light', label: 'Light (standard fill)' },
  { value: 'Medium', label: 'Medium' },
  { value: 'Dark', label: 'Dark' },
  { value: 'FrameColor', label: 'Frame colour (high contrast)' },
  { value: 'White', label: 'White' },
  { value: 'Black', label: 'Black' },
  { value: 'mono', label: 'Monochrome (single colour)' },
]

const LAYOUTS: Option[] = [
  { value: 'grid', label: 'Grid at the viewport centre' },
  { value: 'row', label: 'Single row' },
  { value: 'viewport', label: 'Stacked at the viewport centre' },
  { value: 'selection', label: 'Inside the selected frame' },
]

export function SettingsPane(props: {
  canCreateComponents: boolean
  style: SymbolStyle
  insert: InsertOptions
  onStyle: (patch: Partial<SymbolStyle>) => void
  onInsert: (patch: Partial<InsertOptions>) => void
  onReset: () => void
}) {
  const { style, insert } = props
  return (
    <div class="pane">
      <div class="section">
        <h3>Rendering</h3>
        <div class="row">
          <Field label="Symbol size" grow hint="milsymbol base size; larger values give more detail">
            <NumberInput value={style.size} min={8} max={200} onChange={v => props.onStyle({ size: v })} />
          </Field>
          <Field label="Stroke width" grow>
            <NumberInput value={style.strokeWidth} min={1} max={12} step={0.5} onChange={v => props.onStyle({ strokeWidth: v })} />
          </Field>
        </div>
        <Field label="Colour mode">
          <Select value={style.colorMode} options={COLOR_MODES} onChange={v => props.onStyle({ colorMode: v as ColorModeName })} />
        </Field>
        {style.colorMode === 'mono' && (
          <Field label="Monochrome colour">
            <div class="row">
              <input
                type="color"
                value={style.monoColor}
                onInput={e => props.onStyle({ monoColor: (e.currentTarget as HTMLInputElement).value })}
              />
              <input
                class="grow mono"
                type="text"
                value={style.monoColor}
                onInput={e => props.onStyle({ monoColor: (e.currentTarget as HTMLInputElement).value })}
              />
            </div>
          </Field>
        )}
        <Toggle label="Draw frame" checked={style.frame} onChange={v => props.onStyle({ frame: v })} />
        <Toggle label="Fill frame" checked={style.fill} onChange={v => props.onStyle({ fill: v })} />
        <Toggle label="Draw icon" checked={style.icon} onChange={v => props.onStyle({ icon: v })} />
        <Toggle label="Civilian colour ramp for civilian symbols" checked={style.civilianColor} onChange={v => props.onStyle({ civilianColor: v })} />
        <Toggle label="Simplified status modifier" checked={style.simpleStatusModifier} onChange={v => props.onStyle({ simpleStatusModifier: v })} />
        <Toggle label="Square bounding box" title="Pads every symbol to a square so mixed frames align in a grid" checked={style.square} onChange={v => props.onStyle({ square: v })} />
        <Field label="Standard" hint="APP-6E and MIL-STD-2525E differ for a handful of glyphs">
          <Select
            value={style.standard}
            options={[{ value: 'APP6', label: 'STANAG APP-6E' }, { value: '2525', label: 'MIL-STD-2525E' }]}
            onChange={v => props.onStyle({ standard: v as 'APP6' | '2525' })}
          />
        </Field>
      </div>

      <Accordion title="Text amplifiers">
        <Toggle label="Show text amplifier fields" checked={style.infoFields} onChange={v => props.onStyle({ infoFields: v })} />
        <Toggle
          label="Outline amplifier text"
          title="Converts the inserted text layers to vector outlines, so the result no longer depends on a font being installed"
          checked={style.outlineText}
          onChange={v => props.onStyle({ outlineText: v })}
        />
        <Field label="Amplifier text size">
          <NumberInput value={style.infoSize} min={10} max={100} onChange={v => props.onStyle({ infoSize: v })} />
        </Field>
      </Accordion>

      <Accordion title="Contrast outline">
        <Field label="Outline width" hint="0 disables the halo drawn behind the symbol">
          <NumberInput value={style.outlineWidth} min={0} max={20} onChange={v => props.onStyle({ outlineWidth: v })} />
        </Field>
        {style.outlineWidth > 0 && (
          <Field label="Outline colour">
            <div class="row">
              <input type="color" value={style.outlineColor} onInput={e => props.onStyle({ outlineColor: (e.currentTarget as HTMLInputElement).value })} />
              <input class="grow mono" type="text" value={style.outlineColor} onInput={e => props.onStyle({ outlineColor: (e.currentTarget as HTMLInputElement).value })} />
            </div>
          </Field>
        )}
      </Accordion>

      <div class="section">
        <h3>Insertion</h3>
        <div class="row">
          <Field label="Layout" grow>
            <Select value={insert.layout} options={LAYOUTS} onChange={v => props.onInsert({ layout: v as LayoutMode })} />
          </Field>
          <Field label="Columns" grow>
            <NumberInput value={insert.columns} min={1} max={40} onChange={v => props.onInsert({ columns: v })} />
          </Field>
        </div>
        <div class="row">
          <Field label="Gap (px)" grow>
            <NumberInput value={insert.gap} min={0} max={400} onChange={v => props.onInsert({ gap: v })} />
          </Field>
          <Field label="Height (px)" grow hint="0 keeps the symbol's natural size">
            <NumberInput value={insert.targetHeight} min={0} max={4000} onChange={v => props.onInsert({ targetHeight: v })} />
          </Field>
        </div>
        {props.canCreateComponents ? (
          <Toggle label="Insert as components" checked={insert.asComponents} onChange={v => props.onInsert({ asComponents: v })} />
        ) : (
          <div class="muted">Components are only available in Figma Design.</div>
        )}
        {insert.layout === 'selection' && (
          <div class="muted">
            Symbols are added to the selected frame, group or component. With nothing selected they
            go on the page.
          </div>
        )}
        <Toggle label="Add a caption under each symbol" checked={insert.captions} onChange={v => props.onInsert({ captions: v })} />
        <Toggle label="Wrap everything in one frame" checked={insert.wrapInFrame} onChange={v => props.onInsert({ wrapInFrame: v })} />
        {insert.wrapInFrame && (
          <Field label="Frame name">
            <input
              type="text"
              value={insert.frameName}
              onInput={e => props.onInsert({ frameName: (e.currentTarget as HTMLInputElement).value })}
            />
          </Field>
        )}
      </div>

      <div class="hr" />
      <button class="btn" onClick={props.onReset}>Reset all settings</button>
      <div class="muted">
        {searchableCount} selectable entities of {catalogSize} · {catalog.sets.length} symbol sets · {catalog.standard}
      </div>
    </div>
  )
}
