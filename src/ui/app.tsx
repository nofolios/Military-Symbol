import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks'
import { formatSidc, parseSidc, STANDARD_IDENTITIES, type Sidc } from '../core/sidc'
import type {
  InsertOptions, RenderedSymbol, SelectedSymbolInfo, SymbolStyle, SymbolUpdate,
} from '../shared/messages'
import { onPluginMessage, send, storageGet, storageSet, notify } from './bridge'
import { canDraw, isDrawable, render } from './render'
import { BuildPane } from './panes/build'
import { BrowsePane } from './panes/browse'
import { BatchPane, type BatchItem } from './panes/batch'
import { PanelHeader } from './brand'
import { OrbatPane, DEFAULT_ORBAT, type OrbatSettings } from './panes/orbat'
import { SelectionPane } from './panes/selection'
import { SettingsPane } from './panes/settings'
import {
  MAX_RECENTS, buildSpec, initialState, layerName, pushRecent, specFrom,
  type AppState, type TabId,
} from './store'
import { sanitiseCodes, sanitiseInsert, sanitiseStyle } from './prefs'
import type { OrbatBuild } from './orbat-payload'

const TABS: { id: TabId; label: string }[] = [
  { id: 'build', label: 'Build' },
  { id: 'browse', label: 'Browse' },
  { id: 'batch', label: 'Batch' },
  { id: 'orbat', label: 'ORBAT' },
  { id: 'selection', label: 'Canvas' },
  { id: 'settings', label: 'Settings' },
]

const STORAGE_KEY = 'app6e.prefs.v1'

/**
 * Above this many symbols in one go the editor visibly stalls and the
 * postMessage payload gets large, so we stop and say so rather than appearing
 * to hang. The standard's own sheets are never this big in one frame.
 */
const MAX_BATCH = 500

/**
 * The full SVG is only needed for the preview and the clipboard. Dropping it
 * before postMessage roughly halves what crosses the bridge on a large batch;
 * the sandbox imports `geometrySvg`.
 */
function forTransport(symbols: RenderedSymbol[]): RenderedSymbol[] {
  return symbols.map(s => (s.geometrySvg ? { ...s, svg: '' } : s))
}

function forUpdateTransport(updates: SymbolUpdate[]): SymbolUpdate[] {
  return updates.map(u => ({ ...u, symbol: forTransport([u.symbol])[0] }))
}

interface Prefs {
  style: SymbolStyle
  insert: InsertOptions
  favourites: string[]
  recents: string[]
  sidc: string
}

export function App() {
  const [state, setState] = useState<AppState>(initialState)
  const [selection, setSelection] = useState<SelectedSymbolInfo[]>([])
  /** how many nodes are selected on the canvas; `selection` may be a capped prefix */
  const [selectionTotal, setSelectionTotal] = useState(0)
  const [browseSelected, setBrowseSelected] = useState<string[]>([])
  const [batchItems, setBatchItems] = useState<BatchItem[]>([])
  const [orbat, setOrbat] = useState<OrbatSettings>(DEFAULT_ORBAT)
  const [orbatBuild, setOrbatBuild] = useState<OrbatBuild | null>(null)
  const [busy, setBusy] = useState(false)
  const [canCreateComponents, setCanCreateComponents] = useState(true)
  const loadedPrefs = useRef(false)

  /* ------------------------------------------------------------- lifecycle */

  useEffect(() => {
    const off = onPluginMessage(msg => {
      switch (msg.type) {
        case 'init':
          setSelection(msg.selection)
          setSelectionTotal(msg.total)
          setCanCreateComponents(msg.canCreateComponents)
          // The relaunch button on an inserted symbol opens straight to Canvas.
          if (msg.command === 'edit') setState(s => ({ ...s, tab: 'selection' }))
          break
        case 'selection':
          setSelection(msg.selection)
          setSelectionTotal(msg.total)
          break
        case 'inserted':
        case 'updated':
          setBusy(false)
          break
        case 'error':
          setBusy(false)
          break
      }
    })
    send({ type: 'ui-ready' })
    void (async () => {
      const prefs = await storageGet<Prefs>(STORAGE_KEY)
      if (prefs) {
        setState(s => ({
          ...s,
          style: sanitiseStyle(prefs.style, s.style),
          insert: sanitiseInsert(prefs.insert, s.insert),
          favourites: sanitiseCodes(prefs.favourites, 200),
          recents: sanitiseCodes(prefs.recents, MAX_RECENTS),
          sidc: typeof prefs.sidc === 'string' && prefs.sidc.length >= 10 ? parseSidc(prefs.sidc) : s.sidc,
        }))
      }
      loadedPrefs.current = true
    })()
    return off
  }, [])

  // Persist preferences, but never before the stored ones have been read back.
  const prefsSignature = JSON.stringify([state.style, state.insert, state.favourites, state.recents, formatSidc(state.sidc)])
  useEffect(() => {
    if (!loadedPrefs.current) return
    const timer = setTimeout(() => {
      storageSet(STORAGE_KEY, {
        style: state.style,
        insert: state.insert,
        favourites: state.favourites,
        recents: state.recents,
        sidc: formatSidc(state.sidc),
      } satisfies Prefs)
    }, 400)
    return () => clearTimeout(timer)
  }, [prefsSignature])

  /* --------------------------------------------------------------- actions */

  const patchSidc = useCallback((p: Partial<Sidc>) => setState(s => ({ ...s, sidc: { ...s.sidc, ...p } })), [])
  const setAmplifier = useCallback(
    (key: string, value: string) => setState(s => ({ ...s, amplifiers: { ...s.amplifiers, [key]: value } })),
    []
  )
  const patchStyle = useCallback((p: Partial<SymbolStyle>) => setState(s => ({ ...s, style: { ...s.style, ...p } })), [])
  const patchInsert = useCallback((p: Partial<InsertOptions>) => setState(s => ({ ...s, insert: { ...s.insert, ...p } })), [])

  const copyText = useCallback((text: string, what: string) => {
    const clipboard = navigator.clipboard
    if (!clipboard) {
      notify('This browser would not give the plugin clipboard access.', true)
      return
    }
    // writeText can be refused outright in a sandboxed frame, so the toast has
    // to wait for the promise rather than assume it worked.
    clipboard.writeText(text).then(
      () => notify(`${what} copied`),
      () => notify(`Could not copy the ${what.toLowerCase()}.`, true)
    )
  }, [])

  const copySvg = useCallback(() => {
    try {
      copyText(render(buildSpec(state)).svg, 'SVG')
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not render this symbol', true)
    }
  }, [state, copyText])

  const toggleFavourite = useCallback(() => {
    setState(s => {
      const code = formatSidc(s.sidc)
      return {
        ...s,
        favourites: s.favourites.includes(code) ? s.favourites.filter(f => f !== code) : [code, ...s.favourites],
      }
    })
  }, [])

  const renderAll = useCallback((sidcs: { sidc: string; label?: string }[]): RenderedSymbol[] => {
    const out: RenderedSymbol[] = []
    const targetHeight = state.insert.targetHeight
    for (const item of sidcs) {
      try {
        // Batch symbols carry no amplifier text: those belong to the one symbol
        // being built, not to every entry in a sheet.
        out.push(render(specFrom(item.sidc, state, item.label), { targetHeight }))
      } catch (e) {
        console.error('render failed', item.sidc, e)
      }
    }
    return out
  }, [state])

  const doInsert = useCallback((symbols: RenderedSymbol[]) => {
    if (symbols.length === 0) {
      notify('Nothing to insert.', true)
      return
    }
    let batch = symbols
    if (batch.length > MAX_BATCH) {
      batch = batch.slice(0, MAX_BATCH)
      notify(`Inserting the first ${MAX_BATCH} of ${symbols.length} symbols.`)
    }
    // Codes APP-6E has no point symbol for render as milsymbol's question mark.
    // Every tab's Insert button ends up here, so this is the one place that has
    // to hold them back; the panes flag them before it gets this far.
    const drawable = batch.filter(isDrawable)
    const held = batch.length - drawable.length
    if (held > 0) {
      notify(
        held === batch.length
          ? 'APP-6E defines no point symbol for this code, so there is nothing to insert.'
          : `${held} of ${batch.length} have no point symbol and were left out.`,
        held === batch.length
      )
    }
    if (drawable.length === 0) return
    setBusy(true)
    send({ type: 'insert', symbols: forTransport(drawable), options: state.insert })
    setState(s => {
      let recents = s.recents
      for (const sym of drawable.slice(0, 12)) recents = pushRecent(recents, sym.spec.sidc)
      return { ...s, recents }
    })
  }, [state.insert])

  const insertCurrent = useCallback(() => {
    try {
      doInsert([render(buildSpec(state), { targetHeight: state.insert.targetHeight })])
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not render this symbol', true)
    }
  }, [state, doInsert])

  const insertAffiliationVariants = useCallback(() => {
    let symbols: RenderedSymbol[]
    try {
      symbols = STANDARD_IDENTITIES.map(si =>
        render(
          { ...buildSpec(state, { ...state.sidc, standardIdentity: si.code }), label: si.label },
          { targetHeight: state.insert.targetHeight }
        )
      )
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not render this symbol', true)
      return
    }
    setBusy(true)
    send({
      type: 'create-variants',
      symbols: forTransport(symbols),
      propertyName: 'Affiliation',
      setName: layerName(state.sidc),
      options: state.insert,
    })
  }, [state])

  const restyleSelection = useCallback(() => {
    const ours = selection.filter(s => s.spec)
    if (ours.length === 0) return
    const updates = ours.map(item => ({
      nodeId: item.nodeId,
      // Re-render at the height the node already has so nothing on the canvas moves.
      symbol: render({ ...item.spec!, style: { ...state.style } }, { targetHeight: item.height }),
    }))
    setBusy(true)
    send({ type: 'update-selection', updates: forUpdateTransport(updates) })
  }, [selection, state.style])

  const setSelectionAffiliation = useCallback((code: string) => {
    const ours = selection.filter(s => s.spec)
    if (ours.length === 0) return
    const updates = ours.map(item => {
      const spec = item.spec!
      const next = { ...parseSidc(spec.sidc), standardIdentity: code }
      return {
        nodeId: item.nodeId,
        symbol: render(
          { ...spec, sidc: formatSidc(next), style: { ...state.style }, label: layerName(next) },
          { targetHeight: item.height }
        ),
      }
    })
    setBusy(true)
    send({ type: 'update-selection', updates: forUpdateTransport(updates) })
  }, [selection, state.style])

  /* ---------------------------------------------------------------- footer */

  const ourSelectionCount = useMemo(() => selection.filter(s => s.spec).length, [selection])

  // The preview says so too, but the button has to agree with it: inserting a
  // code with no point symbol only ever produces a question mark.
  const currentDrawable = useMemo(
    () => canDraw(formatSidc(state.sidc), state.style.standard),
    [formatSidc(state.sidc), state.style.standard]
  )

  const footer = (() => {
    switch (state.tab) {
      case 'build':
        return (
          <>
            <button
              class="btn primary grow"
              disabled={busy || !currentDrawable}
              title={currentDrawable ? undefined : 'APP-6E defines no point symbol for this code'}
              onClick={insertCurrent}
            >
              Insert symbol
            </button>
            <button
              class="btn"
              disabled={busy || !canCreateComponents || !currentDrawable}
              title={
                !canCreateComponents
                  ? 'Component sets are only available in Figma Design'
                  : currentDrawable
                    ? 'Create a component set with one variant per affiliation'
                    : 'APP-6E defines no point symbol for this code'
              }
              onClick={insertAffiliationVariants}
            >
              Variants
            </button>
          </>
        )
      case 'browse':
        return (
          <button
            class="btn primary grow"
            disabled={busy || browseSelected.length === 0}
            onClick={() => doInsert(renderAll(browseSelected.map(sidc => ({ sidc }))))}
          >
            Insert {browseSelected.length || ''} selected
          </button>
        )
      case 'batch':
        return (
          <button
            class="btn primary grow"
            disabled={busy || batchItems.length === 0}
            onClick={() => doInsert(renderAll(batchItems))}
          >
            Insert {batchItems.length || ''} symbol{batchItems.length === 1 ? '' : 's'}
          </button>
        )
      case 'orbat':
        return (
          <button
            class="btn primary grow"
            disabled={busy || !orbatBuild?.payload}
            onClick={() => {
              if (!orbatBuild?.payload) return
              setBusy(true)
              send({
                type: 'insert-orbat',
                payload: { ...orbatBuild.payload, symbols: forTransport(orbatBuild.payload.symbols) },
              })
            }}
          >
            Draw {orbatBuild?.count ? `${orbatBuild.count} unit${orbatBuild.count === 1 ? '' : 's'}` : 'ORBAT'}
          </button>
        )
      case 'selection':
        return (
          <button class="btn grow" disabled={ourSelectionCount === 0} onClick={() => send({ type: 'zoom-to-selection' })}>
            Zoom to selection
          </button>
        )
      default:
        return <span class="muted grow">Settings apply to every symbol this plugin creates.</span>
    }
  })()

  return (
    <div class="app">
      <PanelHeader subtitle="STANAG APP-6E" />

      <div class="tabs" role="tablist">
        {TABS.map(t => (
          <button
            key={t.id}
            class="tab"
            role="tab"
            aria-selected={state.tab === t.id}
            onClick={() => setState(s => ({ ...s, tab: t.id }))}
          >
            {t.label}
            {t.id === 'selection' && ourSelectionCount > 0 ? ` (${ourSelectionCount})` : ''}
          </button>
        ))}
      </div>

      <div class="body">
        {state.tab === 'build' && (
          <BuildPane
            state={state}
            patchSidc={patchSidc}
            setAmplifier={setAmplifier}
            onToggleFavourite={toggleFavourite}
            onCopySvg={copySvg}
            onCopySidc={() => copyText(formatSidc(state.sidc), 'SIDC')}
          />
        )}
        {state.tab === 'browse' && (
          <BrowsePane
            state={state}
            selected={browseSelected}
            onSelectedChange={setBrowseSelected}
            onOpenInBuilder={sidc => setState(s => ({ ...s, sidc, tab: 'build' }))}
            // Selections are full SIDCs; the pane moves them onto the new
            // affiliation itself, so they stay picked instead of being dropped.
            onAffiliationChange={code => patchSidc({ standardIdentity: code })}
          />
        )}
        {state.tab === 'batch' && <BatchPane state={state} items={batchItems} onItemsChange={setBatchItems} />}
        {state.tab === 'orbat' && (
          <OrbatPane
            state={state}
            settings={orbat}
            onSettings={patch => setOrbat(s => ({ ...s, ...patch }))}
            onBuild={setOrbatBuild}
          />
        )}
        {state.tab === 'selection' && (
          <SelectionPane
            state={state}
            selection={selection}
            onOpenInBuilder={(sidc, amplifiers) => setState(s => ({ ...s, sidc, amplifiers, tab: 'build' }))}
            total={selectionTotal}
            onRestyle={restyleSelection}
            onSetAffiliation={setSelectionAffiliation}
          />
        )}
        {state.tab === 'settings' && (
          <SettingsPane
            canCreateComponents={canCreateComponents}
            style={state.style}
            insert={state.insert}
            onStyle={patchStyle}
            onInsert={patchInsert}
            onReset={() => setState(s => ({ ...initialState(), favourites: s.favourites, recents: s.recents, tab: s.tab }))}
          />
        )}
      </div>

      <div class="footer">{footer}</div>
    </div>
  )
}
