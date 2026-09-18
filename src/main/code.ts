/**
 * Plugin sandbox entry point.
 *
 * This half of the plugin deliberately knows nothing about APP-6E. The UI runs
 * milsymbol and hands over finished, text-free SVG plus the amplifier text as
 * structured data; the sandbox turns that into Figma nodes, remembers how each
 * node was made, and reports on the selection.
 *
 * Two rules drive the design:
 *   1. The symbol is rendered at its final size by milsymbol, so nothing here
 *      ever has to rescale geometry and stroke weights stay correct.
 *   2. Text never reaches `figma.createNodeFromSvg`. Figma's importer resolves
 *      fonts on its own and can leave text with a missing font, which is then
 *      unsafe to resize. We create the text nodes ourselves instead.
 */
import {
  PLUGIN_DATA_KEY,
  type InsertOptions,
  type OrbatPayload,
  type PluginMessage,
  type RenderedSymbol,
  type SelectedSymbolInfo,
  type SymbolSpec,
  type SymbolUpdate,
  type TextPlacement,
  type UiMessage,
} from '../shared/messages'

const UI_DEFAULT = { width: 460, height: 720 }

/**
 * Components, component sets and variants are Figma Design concepts. The
 * manifest currently lists only that surface, but the guard keeps the plugin
 * honest if it is ever widened to FigJam or Slides.
 */
const canCreateComponents = () => figma.editorType === 'figma'
const ANCHOR_KEY = 'anchor'

/**
 * Font families we would like for amplifier text, best first, each with the
 * bold face the standard requires for the exercise, joker, faker and special
 * headquarters amplifiers.
 */
const PREFERRED_FAMILIES: { family: string; regular: string; bold: string }[] = [
  { family: 'Arial', regular: 'Regular', bold: 'Bold' },
  { family: 'Helvetica', regular: 'Regular', bold: 'Bold' },
  { family: 'Roboto', regular: 'Regular', bold: 'Bold' },
  { family: 'Inter', regular: 'Regular', bold: 'Bold' },
  { family: 'Inter', regular: 'Regular', bold: 'Semi Bold' },
  { family: 'Inter', regular: 'Regular', bold: 'Medium' },
]
const FALLBACK_FONT: FontName = { family: 'Inter', style: 'Regular' }

interface AmplifierFonts {
  regular: FontName
  /** falls back to the regular face when no bold one can be loaded */
  bold: FontName
}

let amplifierFonts: AmplifierFonts | null = null

function post(msg: PluginMessage) {
  figma.ui.postMessage(msg)
}

/**
 * Resolve one font for every amplifier. `listAvailableFontsAsync` returns
 * thousands of entries, so this runs once per plugin session.
 */
async function resolveAmplifierFonts(): Promise<AmplifierFonts> {
  if (amplifierFonts) return amplifierFonts
  try {
    const available = await figma.listAvailableFontsAsync()
    const have = new Set(available.map(f => f.fontName.family + '|' + f.fontName.style))
    for (const candidate of PREFERRED_FAMILIES) {
      const regular: FontName = { family: candidate.family, style: candidate.regular }
      if (!have.has(regular.family + '|' + regular.style)) continue
      await figma.loadFontAsync(regular)
      let bold = regular
      const boldFace: FontName = { family: candidate.family, style: candidate.bold }
      if (have.has(boldFace.family + '|' + boldFace.style)) {
        try {
          await figma.loadFontAsync(boldFace)
          bold = boldFace
        } catch {
          bold = regular
        }
      }
      amplifierFonts = { regular, bold }
      return amplifierFonts
    }
  } catch {
    // fall through to the guaranteed font
  }
  await figma.loadFontAsync(FALLBACK_FONT)
  amplifierFonts = { regular: FALLBACK_FONT, bold: FALLBACK_FONT }
  return amplifierFonts
}

/** The regular face, for captions and labels that carry no weight of their own. */
async function resolveAmplifierFont(): Promise<FontName> {
  return (await resolveAmplifierFonts()).regular
}

/* ------------------------------------------------------------- plugin data */

/**
 * Read a spec off a node.
 *
 * Plugin data is whatever was written last - by an older version of this
 * plugin, by a copy-paste from another file, or by another plugin using the
 * same key. Only a well-formed spec is handed back, with the fields the UI
 * dereferences guaranteed to exist.
 */
function readSpec(node: BaseNode): SymbolSpec | null {
  try {
    const raw = (node as SceneNode).getPluginData(PLUGIN_DATA_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<SymbolSpec>
    if (!parsed || typeof parsed !== 'object') return null
    if (typeof parsed.sidc !== 'string' || parsed.sidc.length < 10) return null

    const amplifiers: Record<string, string | number> = {}
    if (parsed.amplifiers && typeof parsed.amplifiers === 'object') {
      for (const key of Object.keys(parsed.amplifiers)) {
        const value = (parsed.amplifiers as Record<string, unknown>)[key]
        if (typeof value === 'string' || typeof value === 'number') amplifiers[key] = value
      }
    }
    const style = parsed.style && typeof parsed.style === 'object' ? parsed.style : ({} as SymbolSpec['style'])
    return {
      sidc: parsed.sidc,
      amplifiers,
      style: { ...style, outlineText: style.outlineText === true },
      label: typeof parsed.label === 'string' && parsed.label ? parsed.label : 'APP-6E symbol',
    }
  } catch {
    return null
  }
}

function writeSpec(node: SceneNode, spec: SymbolSpec, anchor: { x: number; y: number } | null) {
  node.setPluginData(PLUGIN_DATA_KEY, JSON.stringify(spec))
  if (anchor) node.setSharedPluginData(PLUGIN_DATA_KEY, ANCHOR_KEY, JSON.stringify(anchor))
  try {
    node.setRelaunchData({ edit: spec.label + ' - ' + spec.sidc })
  } catch {
    // setRelaunchData is unavailable on some node types; never fail an insert over it
  }
}

/**
 * How many selected nodes are described to the UI.
 *
 * A batch insert selects everything it made, which is what a user wants for
 * dragging the lot into place. But every described node costs a JSON parse here
 * and a thumbnail render there, so a 500-symbol insert would stall the panel.
 * The list is capped and the true total reported alongside it.
 */
const SELECTION_REPORT_LIMIT = 60

function describeSelection(): { selection: SelectedSymbolInfo[]; total: number } {
  const all = figma.currentPage.selection
  const selection = all.slice(0, SELECTION_REPORT_LIMIT).map(n => ({
    nodeId: n.id,
    nodeName: n.name,
    width: 'width' in n ? n.width : 0,
    height: 'height' in n ? n.height : 0,
    spec: readSpec(n),
  }))
  return { selection, total: all.length }
}

/* ------------------------------------------------------------------ colour */

function toRgb(css: string): RGB {
  try {
    return figma.util.rgb(css)
  } catch {
    return { r: 0, g: 0, b: 0 }
  }
}

/* ------------------------------------------------------------ node building */

/**
 * Rebuild the text amplifiers as Figma text nodes.
 *
 * Figma positions text by the top of its box, so the two vertical references
 * the SVG can use both need converting. A normal amplifier's y is the glyph
 * baseline, which sits about 0.8 em below the box top for Latin text in Inter,
 * Arial and Roboto. The amplifiers drawn inside the frame instead carry
 * `dominant-baseline="middle"`, so their y is the visual centre of the line.
 */
async function addTextAmplifiers(frame: FrameNode, texts: TextPlacement[], outline: boolean) {
  if (texts.length === 0) return
  const fonts = await resolveAmplifierFonts()
  const created: TextNode[] = []

  for (const t of texts) {
    if (!t.characters) continue
    const node = figma.createText()
    node.fontName = t.bold ? fonts.bold : fonts.regular
    node.fontSize = Math.max(1, t.fontSize)
    node.characters = t.characters
    node.textAutoResize = 'WIDTH_AND_HEIGHT'
    node.fills = [{ type: 'SOLID', color: toRgb(t.color) }]
    node.x = t.anchor === 'middle' ? t.x - node.width / 2 : t.anchor === 'end' ? t.x - node.width : t.x
    node.y =
      t.baseline === 'middle'
        ? t.baselineY - node.height / 2
        : t.baselineY - node.fontSize * 0.8
    node.name = t.characters.length > 24 ? t.characters.slice(0, 24) : t.characters
    frame.appendChild(node)
    created.push(node)
  }

  if (outline) {
    for (const node of created) {
      try {
        figma.flatten([node], frame)
      } catch {
        // leave it as live text if flattening is refused
      }
    }
  }
}

/** Turn one rendered symbol into a Figma node. */
async function buildSymbolNode(symbol: RenderedSymbol): Promise<FrameNode> {
  const frame = figma.createNodeFromSvg(symbol.geometrySvg || symbol.svg)
  if (frame.width < 0.01 || frame.height < 0.01) {
    frame.remove()
    throw new Error('Degenerate symbol for ' + symbol.spec.sidc)
  }

  frame.name = symbol.spec.label
  // Amplifiers and movement arrows routinely overhang the frame bounds.
  frame.clipsContent = false
  frame.fills = []

  await addTextAmplifiers(frame, symbol.texts || [], symbol.spec.style.outlineText)
  writeSpec(frame, symbol.spec, symbol.anchor)
  return frame
}

/* ------------------------------------------------------------- positioning */

/**
 * Centre a symbol in a box on its octagon anchor rather than on its bounding
 * box. Echelon marks sit above the frame and headquarters staffs hang below
 * it, so bounding-box centring makes a row of mixed symbols look ragged; the
 * octagon anchor is the point the standard puts on the map, and aligning that
 * lines every frame up.
 */
function centreOnAnchor(node: FrameNode, symbol: RenderedSymbol, boxX: number, boxY: number, boxW: number, boxH: number) {
  const a = symbol.anchor
  if (a && Number.isFinite(a.x) && Number.isFinite(a.y) && symbol.width > 0 && symbol.height > 0) {
    // The node may have been built from a slightly different intrinsic size.
    const sx = node.width / symbol.width
    const sy = node.height / symbol.height
    node.x = boxX + boxW / 2 - a.x * sx
    node.y = boxY + boxH / 2 - a.y * sy
  } else {
    node.x = boxX + (boxW - node.width) / 2
    node.y = boxY + (boxH - node.height) / 2
  }
}

function viewportOrigin(totalWidth: number, totalHeight: number) {
  const c = figma.viewport.center
  return { x: Math.round(c.x - totalWidth / 2), y: Math.round(c.y - totalHeight / 2) }
}

/**
 * Node types that establish their own coordinate system, so a child's `x`/`y`
 * are measured from the container's top-left corner.
 *
 * Groups and boolean operations do **not**: the plugin typings say a child's
 * position "is not relative to its direct parent if the parent is a group or a
 * boolean operation" - it stays in page coordinates. Writing container-local
 * numbers onto a group's child therefore flings it across the canvas and blows
 * up the group's bounds, so the two cases have to be told apart.
 */
const COORDINATE_PARENTS = ['FRAME', 'COMPONENT', 'COMPONENT_SET', 'SECTION']

interface InsertTarget {
  container: BaseNode & ChildrenMixin
  /**
   * 'local'  - the container defines a coordinate system; children are placed
   *            relative to its top-left corner.
   * 'shared' - a group or boolean operation: its children keep the container's
   *            own coordinate space, so the layout is offset by its position.
   * 'page'   - the page itself; the layout is centred on the viewport.
   */
  coords: 'local' | 'shared' | 'page'
}

/**
 * Whether a node will actually take new children.
 *
 * "Has a children array" is not enough. A component set holds variants and
 * nothing else, an instance and everything inside it belongs to its main
 * component, and the typings warn that reparenting "is subject to many
 * restrictions" and throws when they are broken. Asking first is cheaper than
 * catching a throw halfway through a batch.
 */
function acceptsChildren(node: BaseNode): boolean {
  if (!('children' in node)) return false
  if (node.type === 'COMPONENT_SET') return false
  for (let p: BaseNode | null = node; p; p = p.parent) {
    if (p.type === 'INSTANCE') return false
  }
  return true
}

const asTarget = (node: BaseNode): InsertTarget => ({
  container: node as BaseNode & ChildrenMixin,
  coords: node.type === 'PAGE' ? 'page' : COORDINATE_PARENTS.indexOf(node.type) >= 0 ? 'local' : 'shared',
})

/**
 * Where to drop new symbols when the layout is "selection": the selected node
 * if it can hold children, otherwise its parent, otherwise the page. Falling
 * back to the page keeps the insert working rather than failing when the
 * selection is a bare vector.
 */
function selectionTarget(): InsertTarget {
  const page = asTarget(figma.currentPage)
  const [first] = figma.currentPage.selection
  if (!first) return page

  if (acceptsChildren(first)) return asTarget(first)
  const parent = first.parent
  if (parent && parent.type !== 'PAGE' && acceptsChildren(parent)) return asTarget(parent)
  return page
}

/**
 * Move the laid-out nodes into their container.
 *
 * Even after `acceptsChildren`, a reparent can still be refused - the typings
 * list a whole family of exceptions - and a throw here would escape all the way
 * to the message handler's toast, leaving every node already built stranded on
 * the page at container-local coordinates with nothing cleaning them up. So a
 * refusal degrades to a plain page insert, with the layout kept intact around
 * the viewport centre.
 */
function placeInContainer(
  nodes: SceneNode[],
  target: InsertTarget,
  origin: { x: number; y: number },
  totalW: number,
  totalH: number
) {
  if (target.coords === 'page' && target.container === figma.currentPage) {
    for (const n of nodes) figma.currentPage.appendChild(n)
    return
  }
  // Captured before the first append, because a failure partway through would
  // otherwise leave some nodes already rewritten into the container's space.
  const laid = nodes.map(n => ({ node: n, dx: n.x - origin.x, dy: n.y - origin.y }))
  try {
    for (const n of nodes) {
      const x = n.x
      const y = n.y
      target.container.appendChild(n)
      // appendChild preserves the absolute position, so for a container with
      // its own coordinate system the local one has to be re-applied.
      if (target.coords === 'local') {
        n.x = x
        n.y = y
      }
    }
    return
  } catch (e) {
    console.error('The selected container refused the symbols; falling back to the page', e)
  }

  const fallback = viewportOrigin(totalW, totalH)
  for (const item of laid) {
    figma.currentPage.appendChild(item.node)
    item.node.x = fallback.x + item.dx
    item.node.y = fallback.y + item.dy
  }
  figma.notify('That container would not take the symbols, so they were placed on the page instead.')
}

async function layoutNodes(
  nodes: FrameNode[],
  opts: InsertOptions,
  captions: string[],
  symbols: RenderedSymbol[]
): Promise<SceneNode[]> {
  if (nodes.length === 0) return []
  const cols =
    opts.layout === 'grid' || opts.layout === 'selection'
      ? Math.max(1, Math.min(opts.columns || 6, 40))
      : opts.layout === 'row' ? nodes.length
      : 1
  const gap = Math.max(0, opts.gap == null ? 24 : opts.gap)

  const cellW = Math.max(1, ...nodes.map(n => n.width))
  const cellH = Math.max(1, ...nodes.map(n => n.height))
  const captionH = opts.captions ? 18 : 0

  const rows = Math.ceil(nodes.length / cols)
  const totalW = cols * cellW + (cols - 1) * gap
  const totalH = rows * (cellH + captionH) + (rows - 1) * gap

  const target = opts.layout === 'selection' ? selectionTarget() : asTarget(figma.currentPage)
  const container = target.container
  /**
   * Centre the block on the container, in whichever space its children live in.
   * A frame's children are measured from its own corner, so the offset is zero;
   * a group's children are measured from the frame or page around it, so the
   * group's own position has to be added or the symbols land that far away.
   */
  const box = container as unknown as { width?: number; height?: number; x?: number; y?: number }
  const origin =
    target.coords !== 'page' && typeof box.width === 'number' && typeof box.height === 'number'
      ? {
          x: Math.round((target.coords === 'shared' ? box.x ?? 0 : 0) + (box.width - totalW) / 2),
          y: Math.round((target.coords === 'shared' ? box.y ?? 0 : 0) + (box.height - totalH) / 2),
        }
      : viewportOrigin(totalW, totalH)
  const all: SceneNode[] = []
  const font = opts.captions ? await resolveAmplifierFont() : null

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]
    const col = i % cols
    const row = Math.floor(i / cols)
    const cellX = origin.x + col * (cellW + gap)
    const cellY = origin.y + row * (cellH + captionH + gap)
    centreOnAnchor(node, symbols[i], cellX, cellY, cellW, cellH)
    all.push(node)

    if (font) {
      const caption = figma.createText()
      caption.fontName = font
      caption.fontSize = 10
      caption.characters = captions[i] || ''
      caption.textAutoResize = 'HEIGHT'
      caption.resize(cellW, caption.height)
      caption.textAlignHorizontal = 'CENTER'
      caption.x = cellX
      caption.y = cellY + cellH + 4
      caption.fills = [{ type: 'SOLID', color: { r: 0.35, g: 0.35, b: 0.4 } }]
      caption.name = captions[i] || 'caption'
      all.push(caption)
    }
  }

  if (opts.wrapInFrame) {
    const wrapper = figma.createFrame()
    wrapper.name = opts.frameName || 'APP-6E symbols'
    wrapper.resize(Math.max(1, totalW + 48), Math.max(1, totalH + 48))
    wrapper.x = origin.x - 24
    wrapper.y = origin.y - 24
    wrapper.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }]
    wrapper.clipsContent = false
    // The wrapper goes wherever the symbols were destined, so "inside the
    // selected frame" and "wrap in one frame" compose instead of fighting.
    const wrapperX = wrapper.x
    const wrapperY = wrapper.y
    placeInContainer([wrapper], target, { x: wrapperX, y: wrapperY }, wrapper.width, wrapper.height)
    for (const n of all) {
      const x = n.x
      const y = n.y
      wrapper.appendChild(n)
      n.x = x - wrapperX
      n.y = y - wrapperY
    }
    return [wrapper]
  }

  placeInContainer(all, target, origin, totalW, totalH)
  return all
}

/** Promote a plain frame to a component, preserving its children and metadata. */
function toComponent(frame: FrameNode, name: string): ComponentNode {
  const component = figma.createComponent()
  component.name = name
  component.resizeWithoutConstraints(Math.max(0.01, frame.width), Math.max(0.01, frame.height))
  component.fills = []
  component.clipsContent = false
  component.x = frame.x
  component.y = frame.y
  const spec = readSpec(frame)
  const anchorRaw = frame.getSharedPluginData(PLUGIN_DATA_KEY, ANCHOR_KEY)
  for (const child of [...frame.children]) component.appendChild(child)
  if (spec) {
    let anchor: { x: number; y: number } | null = null
    try {
      anchor = anchorRaw ? JSON.parse(anchorRaw) : null
    } catch {
      anchor = null
    }
    writeSpec(component, spec, anchor)
  }
  const parent = frame.parent
  if (parent && 'appendChild' in parent) (parent as ChildrenMixin & BaseNode).appendChild(component)
  frame.remove()
  return component
}

/* ---------------------------------------------------------------- commands */

async function insertSymbols(symbols: RenderedSymbol[], opts: InsertOptions) {
  const nodes: FrameNode[] = []
  const built: RenderedSymbol[] = []
  const captions: string[] = []
  let failed = 0

  for (let i = 0; i < symbols.length; i++) {
    try {
      nodes.push(await buildSymbolNode(symbols[i]))
      built.push(symbols[i])
      captions.push(symbols[i].spec.label)
    } catch (e) {
      failed++
      console.error('Failed to build symbol', symbols[i] && symbols[i].spec && symbols[i].spec.sidc, e)
    }
    // Yield periodically so a large batch does not lock the editor.
    if (i > 0 && i % 25 === 0) await new Promise(r => setTimeout(r, 0))
  }

  let result = await layoutNodes(nodes, opts, captions, built)

  if (opts.asComponents) {
    if (!canCreateComponents()) {
      figma.notify('Components are only available in Figma Design; inserted as frames instead.')
    } else if (opts.wrapInFrame) {
      // The wrapper itself stays a frame; the symbols inside it become
      // components, so the two options compose instead of one cancelling the
      // other. toComponent re-parents into whatever held the frame.
      const wrapper = result[0]
      if (wrapper && 'children' in wrapper) {
        for (const child of [...(wrapper as FrameNode).children]) {
          if (child.type === 'FRAME' && readSpec(child)) toComponent(child, child.name)
        }
      }
    } else {
      result = result.map(n => (n.type === 'FRAME' ? toComponent(n, n.name) : n))
    }
  }

  figma.currentPage.selection = result
  if (result.length) figma.viewport.scrollAndZoomIntoView(result)
  post({ type: 'inserted', count: nodes.length, failed })
  figma.notify(
    failed === 0
      ? 'Inserted ' + nodes.length + ' symbol' + (nodes.length === 1 ? '' : 's')
      : 'Inserted ' + nodes.length + ', ' + failed + ' failed'
  )
}

/** Variant property values cannot contain "=" or ",". */
const sanitiseVariantValue = (v: string) => v.replace(/[=,]/g, ' ').trim() || 'Variant'

async function createVariants(symbols: RenderedSymbol[], propertyName: string, setName: string) {
  if (!canCreateComponents()) {
    post({ type: 'error', message: 'Component sets are only available in Figma Design.' })
    figma.notify('Component sets are only available in Figma Design.', { error: true })
    return
  }
  const components: ComponentNode[] = []
  for (const s of symbols) {
    try {
      const frame = await buildSymbolNode(s)
      // Figma derives the variant properties from the component's name.
      components.push(toComponent(frame, propertyName + '=' + sanitiseVariantValue(s.spec.label)))
    } catch (e) {
      console.error('variant build failed', e)
    }
  }
  if (components.length === 0) {
    post({ type: 'error', message: 'Nothing to combine into a component set.' })
    return
  }
  const set = figma.combineAsVariants(components, figma.currentPage)
  set.name = setName || 'APP-6E symbol'
  set.layoutMode = 'HORIZONTAL'
  set.itemSpacing = 24
  set.paddingLeft = 24
  set.paddingRight = 24
  set.paddingTop = 24
  set.paddingBottom = 24
  set.primaryAxisSizingMode = 'AUTO'
  set.counterAxisSizingMode = 'AUTO'
  set.counterAxisAlignItems = 'CENTER'
  const origin = viewportOrigin(set.width, set.height)
  set.x = origin.x
  set.y = origin.y
  figma.currentPage.selection = [set]
  figma.viewport.scrollAndZoomIntoView([set])
  post({ type: 'inserted', count: components.length, failed: 0 })
  figma.notify('Created a component set with ' + components.length + ' variants')
}

/**
 * Draw a laid-out ORBAT chart.
 *
 * The UI has already done the tree layout and produced one SVG holding every
 * connector, so this only has to place boxes: connectors first so they sit
 * behind the symbols, then a symbol and a label per cell.
 */
async function insertOrbat(payload: OrbatPayload) {
  const PAD = 32
  const chart = figma.createFrame()
  chart.name = payload.name || 'ORBAT'
  chart.resize(Math.max(1, payload.width + PAD * 2), Math.max(1, payload.height + PAD * 2))
  chart.fills = []
  chart.clipsContent = false
  figma.currentPage.appendChild(chart)

  if (payload.connectorSvg) {
    try {
      const lines = figma.createNodeFromSvg(payload.connectorSvg)
      lines.name = 'Connectors'
      lines.clipsContent = false
      lines.fills = []
      chart.appendChild(lines)
      lines.x = PAD
      lines.y = PAD
    } catch (e) {
      console.error('connector import failed', e)
    }
  }

  const font = await resolveAmplifierFont()
  let failed = 0

  for (let i = 0; i < payload.placements.length; i++) {
    const place = payload.placements[i]
    const symbol = payload.symbols[place.index]
    if (!symbol) continue
    try {
      const node = await buildSymbolNode(symbol)
      chart.appendChild(node)
      const symbolAreaHeight = place.height - place.labelHeight
      centreOnAnchor(node, symbol, PAD + place.x, PAD + place.y, place.width, symbolAreaHeight)

      const label = figma.createText()
      label.fontName = font
      label.fontSize = payload.labelFontSize || 11
      label.characters = place.label
      label.textAutoResize = 'HEIGHT'
      label.resize(Math.max(1, place.width), label.height)
      label.textAlignHorizontal = 'CENTER'
      label.name = place.label
      chart.appendChild(label)
      label.x = PAD + place.x
      label.y = PAD + place.y + symbolAreaHeight + 2
    } catch (e) {
      failed++
      console.error('orbat node failed', place.label, e)
    }
    if (i > 0 && i % 25 === 0) await new Promise(r => setTimeout(r, 0))
  }

  const origin = viewportOrigin(chart.width, chart.height)
  chart.x = origin.x
  chart.y = origin.y
  figma.currentPage.selection = [chart]
  figma.viewport.scrollAndZoomIntoView([chart])
  post({ type: 'inserted', count: payload.placements.length - failed, failed })
  figma.notify('Drew an ORBAT with ' + (payload.placements.length - failed) + ' units')
}

/**
 * Re-render the selected plugin-made symbols in place, keeping their position,
 * their place in the layer tree and any parent auto-layout.
 */
async function updateSelection(updates: SymbolUpdate[]) {
  const selected = new Map(figma.currentPage.selection.map(n => [n.id, n]))
  const targets: { old: SceneNode; symbol: RenderedSymbol }[] = []
  for (const update of updates) {
    const node = selected.get(update.nodeId)
    if (node && readSpec(node) !== null) targets.push({ old: node, symbol: update.symbol })
  }
  if (targets.length === 0) {
    post({ type: 'error', message: 'Select one or more symbols made by this plugin first.' })
    return
  }
  const replacements: SceneNode[] = []
  let skippedInstances = 0
  for (let i = 0; i < targets.length; i++) {
    const old = targets[i].old
    const symbol = targets[i].symbol
    if (!symbol) continue

    // An instance is a copy of a main component; rewriting it would diverge it
    // from its source, so the user has to edit the main component instead.
    if (old.type === 'INSTANCE') {
      skippedInstances++
      continue
    }

    // A main component must survive as the same node, or every instance of it
    // in the file detaches. Swap its contents rather than replacing the node.
    if (old.type === 'COMPONENT') {
      try {
        const fresh = await buildSymbolNode(symbol)
        const moved = [...fresh.children].map(child => ({ child, x: child.x, y: child.y }))
        for (const existing of [...old.children]) existing.remove()
        for (const { child, x, y } of moved) {
          old.appendChild(child)
          // appendChild keeps absolute position; restore the local one.
          child.x = x
          child.y = y
        }
        old.resizeWithoutConstraints(Math.max(0.01, fresh.width), Math.max(0.01, fresh.height))
        writeSpec(old, symbol.spec, symbol.anchor)
        fresh.remove()
        replacements.push(old)
      } catch (e) {
        console.error('component update failed', e)
      }
      continue
    }

    try {
      const fresh = await buildSymbolNode(symbol)
      const parent = old.parent || figma.currentPage
      if ('children' in parent) {
        const container = parent as ChildrenMixin & BaseNode & { insertChild(index: number, child: SceneNode): void }
        const index = container.children.indexOf(old as SceneNode)
        if (index >= 0) container.insertChild(index, fresh)
        else figma.currentPage.appendChild(fresh)
      } else {
        figma.currentPage.appendChild(fresh)
      }
      // Keep the symbol centred where the old one was, whatever its new bounds.
      fresh.x = old.x + (old.width - fresh.width) / 2
      fresh.y = old.y + (old.height - fresh.height) / 2
      old.remove()
      replacements.push(fresh)
    } catch (e) {
      console.error('update failed', e)
    }
  }
  figma.currentPage.selection = replacements
  post({ type: 'updated', count: replacements.length })
  const plural = replacements.length === 1 ? '' : 's'
  figma.notify(
    skippedInstances > 0
      ? 'Updated ' + replacements.length + ' symbol' + plural + '. ' + skippedInstances +
        ' instance' + (skippedInstances === 1 ? '' : 's') + ' skipped - edit the main component instead.'
      : 'Updated ' + replacements.length + ' symbol' + plural
  )
}

/* ------------------------------------------------------------------ wiring */

// No `themeColors`: the panel is light only, matching the Nofolios house
// style, so Figma's dark-theme variables would go unused.
figma.showUI(__html__, { ...UI_DEFAULT, title: 'Military Symbols' })

figma.on('selectionchange', () => post({ type: 'selection', ...describeSelection() }))

figma.ui.onmessage = async (msg: UiMessage) => {
  try {
    switch (msg.type) {
      case 'ui-ready':
        post({
          type: 'init',
          editorType: figma.editorType,
          // 'edit' arrives when the user presses the relaunch button on a symbol.
          command: figma.command || '',
          ...describeSelection(),
          fontsReady: true,
          canCreateComponents: canCreateComponents(),
        })
        break
      case 'insert':
        await insertSymbols(msg.symbols, msg.options)
        break
      case 'create-variants':
        await createVariants(msg.symbols, msg.propertyName, msg.setName)
        break
      case 'update-selection':
        await updateSelection(msg.updates)
        break
      case 'insert-orbat':
        await insertOrbat(msg.payload)
        break
      case 'request-selection':
        post({ type: 'selection', ...describeSelection() })
        break
      case 'storage-get': {
        const value = await figma.clientStorage.getAsync(msg.key)
        post({ type: 'storage-value', key: msg.key, nonce: msg.nonce, value: value === undefined ? null : value })
        break
      }
      case 'storage-set':
        await figma.clientStorage.setAsync(msg.key, msg.value)
        break
      case 'notify':
        figma.notify(msg.message, { error: msg.error })
        break
      case 'resize':
        figma.ui.resize(Math.max(320, Math.round(msg.width)), Math.max(320, Math.round(msg.height)))
        break
      case 'zoom-to-selection':
        if (figma.currentPage.selection.length) {
          figma.viewport.scrollAndZoomIntoView(figma.currentPage.selection)
        }
        break
      case 'close':
        figma.closePlugin()
        break
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error(e)
    post({ type: 'error', message })
    figma.notify(message, { error: true })
  }
}
