import type { ComponentChildren } from 'preact'

export function Field(props: { label: string; hint?: string; children: ComponentChildren; grow?: boolean }) {
  return (
    <div class={'field' + (props.grow ? ' grow' : '')}>
      <label title={props.hint}>{props.label}</label>
      {props.children}
    </div>
  )
}

export interface Option { value: string; label: string; group?: string; disabled?: boolean }

export function Select(props: {
  value: string
  options: Option[]
  onChange: (v: string) => void
  title?: string
  disabled?: boolean
}) {
  const groups: { name: string | undefined; items: Option[] }[] = []
  for (const o of props.options) {
    const last = groups[groups.length - 1]
    if (last && last.name === o.group) last.items.push(o)
    else groups.push({ name: o.group, items: [o] })
  }
  return (
    <select
      value={props.value}
      title={props.title}
      disabled={props.disabled}
      onChange={e => props.onChange((e.currentTarget as HTMLSelectElement).value)}
    >
      {groups.map((g, i) =>
        g.name ? (
          <optgroup key={i} label={g.name}>
            {g.items.map(o => (
              <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>
            ))}
          </optgroup>
        ) : (
          g.items.map(o => (
            <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>
          ))
        )
      )}
    </select>
  )
}

export function Toggle(props: { checked: boolean; onChange: (v: boolean) => void; label: string; title?: string }) {
  return (
    <label class="check" title={props.title}>
      <input
        type="checkbox"
        checked={props.checked}
        onChange={e => props.onChange((e.currentTarget as HTMLInputElement).checked)}
      />
      <span>{props.label}</span>
    </label>
  )
}

/**
 * A number field that will not hand back nonsense while it is being edited.
 *
 * `Number('')` is 0, so a naive handler commits 0 the moment the field is
 * cleared — which for a symbol size means every later insert fails. An empty or
 * half-typed field is simply not published, and the value is clamped to the
 * allowed range when focus leaves.
 */
export function NumberInput(props: {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  title?: string
}) {
  const clamp = (n: number) => {
    let v = n
    if (props.min !== undefined) v = Math.max(props.min, v)
    if (props.max !== undefined) v = Math.min(props.max, v)
    return v
  }
  return (
    <input
      type="number"
      value={String(props.value)}
      min={props.min}
      max={props.max}
      step={props.step ?? 1}
      title={props.title}
      onInput={e => {
        const raw = (e.currentTarget as HTMLInputElement).value.trim()
        if (raw === '' || raw === '-' || raw === '.') return
        const n = Number(raw)
        if (!Number.isFinite(n)) return
        // Clamping mid-typing would fight the user, so only the range's far
        // side is enforced here; the rest waits for blur.
        if (props.max !== undefined && n > props.max) { props.onChange(props.max); return }
        props.onChange(n)
      }}
      onBlur={e => {
        const raw = (e.currentTarget as HTMLInputElement).value.trim()
        const n = Number(raw)
        props.onChange(clamp(Number.isFinite(n) && raw !== '' ? n : props.value))
      }}
    />
  )
}

export function Accordion(props: { title: string; children: ComponentChildren; open?: boolean; badge?: string }) {
  return (
    <details class="acc" open={props.open}>
      <summary>
        <span>{props.title}{props.badge ? <span class="pill" style="margin-left:6px">{props.badge}</span> : null}</span>
      </summary>
      <div class="acc-body">{props.children}</div>
    </details>
  )
}

/** Renders an SVG string. milsymbol output is generated locally and trusted. */
export function Svg(props: { markup: string; class?: string }) {
  return <div class={props.class} dangerouslySetInnerHTML={{ __html: props.markup }} />
}
