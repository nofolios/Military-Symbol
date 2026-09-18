/**
 * The message protocol between the plugin UI (iframe) and the plugin sandbox.
 *
 * The UI owns all symbology: it runs milsymbol and produces SVG. The sandbox is
 * deliberately thin — it turns SVG strings into Figma nodes and reports on the
 * current selection. Every payload here must survive `postMessage` structured
 * cloning, so it is plain JSON only.
 */

/** Everything needed to reproduce a symbol. Persisted on the node as plugin data. */
export interface SymbolSpec {
  /** 30-digit APP-6E SIDC */
  sidc: string
  /** milsymbol amplifier options (uniqueDesignation, higherFormation, …) */
  amplifiers: Record<string, string | number>
  /** rendering style */
  style: SymbolStyle
  /** human label used to name the Figma node */
  label: string
}

export interface SymbolStyle {
  /** nominal symbol size passed to milsymbol (icon octagon half-height in px) */
  size: number
  /** draw the affiliation frame */
  frame: boolean
  /** fill the frame with the affiliation colour */
  fill: boolean
  /** draw the entity icon */
  icon: boolean
  /** show text amplifier fields */
  infoFields: boolean
  /** named colour mode, or 'custom' */
  colorMode: ColorModeName
  /** single colour used when colorMode === 'mono' */
  monoColor: string
  /** width of the contrast outline, 0 disables it */
  outlineWidth: number
  outlineColor: string
  /** frame/icon stroke width in milsymbol units (default 3) */
  strokeWidth: number
  /** use the civilian (purple) colour ramp */
  civilianColor: boolean
  /** APP-6E vs MIL-STD-2525E glyph differences */
  standard: 'APP6' | '2525'
  /** simplified status modifier rendering */
  simpleStatusModifier: boolean
  /** padding around the symbol in milsymbol units */
  padding: number
  /** text size for amplifier fields */
  infoSize: number
  /** flatten the amplifier text into vector outlines after insertion */
  outlineText: boolean
  /** force a square bounding box so symbols line up in a grid */
  square: boolean
}

export type ColorModeName = 'Light' | 'Medium' | 'Dark' | 'FrameColor' | 'Black' | 'White' | 'mono'

/** A `<text>` amplifier lifted out of the SVG, already in frame pixel coordinates. */
export interface TextPlacement {
  characters: string
  /** x of the anchor point */
  x: number
  /**
   * y of the text's vertical reference point: the glyph baseline normally, or
   * the visual centre of the line when `baseline` is 'middle'.
   */
  baselineY: number
  fontSize: number
  anchor: 'start' | 'middle' | 'end'
  /**
   * 'middle' when the SVG carried `dominant-baseline="middle"`, which milsymbol
   * uses for the amplifiers drawn inside the frame.
   */
  baseline: 'alphabetic' | 'middle'
  /** true when the SVG asked for a bold weight */
  bold: boolean
  /** CSS colour string as milsymbol emitted it */
  color: string
}

export interface RenderedSymbol {
  spec: SymbolSpec
  /** the complete SVG, text included — used for the preview and for clipboard export */
  svg: string
  /**
   * The same SVG with every `<text>` removed. This is what the sandbox imports:
   * Figma's SVG importer handles text unpredictably and can leave nodes with a
   * missing font, which then cannot be resized safely.
   */
  geometrySvg: string
  /** the stripped amplifiers, to be rebuilt as real Figma text nodes */
  texts: TextPlacement[]
  /** intrinsic size of the SVG in px */
  width: number
  height: number
  /** milsymbol's octagon anchor: the point that sits on the map location */
  anchor: { x: number; y: number } | null
  /** true when milsymbol reported the SIDC as renderable */
  valid: boolean
  /** false when the code resolves to a bare frame with no entity geometry */
  hasIcon: boolean
  /**
   * True when the renderer drew its "no such symbol" question mark, which means
   * the entity code has no point symbol in APP-6E at all.
   */
  undefinedIcon: boolean
}

export type LayoutMode = 'viewport' | 'grid' | 'row' | 'selection'

export interface InsertOptions {
  layout: LayoutMode
  /** target height in Figma px; 0 keeps the intrinsic size */
  targetHeight: number
  /** grid layout */
  columns: number
  gap: number
  /** wrap each symbol in a Figma component */
  asComponents: boolean
  /** group the inserted symbols under one frame */
  wrapInFrame: boolean
  frameName: string
  /** add a text caption under each symbol */
  captions: boolean
}

/** One cell of a laid-out ORBAT chart. */
export interface OrbatPlacement {
  /** index into the parallel `symbols` array */
  index: number
  label: string
  /** top-left of the cell, relative to the chart origin */
  x: number
  y: number
  width: number
  /** full cell height, symbol area plus label strip */
  height: number
  /** height of the label strip at the bottom of the cell */
  labelHeight: number
}

export interface OrbatPayload {
  name: string
  width: number
  height: number
  symbols: RenderedSymbol[]
  placements: OrbatPlacement[]
  /** every connector as one SVG document in chart coordinates */
  connectorSvg: string
  labelFontSize: number
}

/**
 * One node to re-render, paired with the symbol to replace it with.
 *
 * The pairing is by node id rather than by position, because the UI only ever
 * sees a capped prefix of a large selection and positional pairing would then
 * stamp the wrong symbol onto the nodes it could not see.
 */
export interface SymbolUpdate {
  nodeId: string
  symbol: RenderedSymbol
}

/* ------------------------------------------------------------- UI → sandbox */

export type UiMessage =
  | { type: 'ui-ready' }
  | { type: 'insert'; symbols: RenderedSymbol[]; options: InsertOptions }
  | { type: 'create-variants'; symbols: RenderedSymbol[]; propertyName: string; options: InsertOptions; setName: string }
  | { type: 'update-selection'; updates: SymbolUpdate[] }
  | { type: 'insert-orbat'; payload: OrbatPayload }
  | { type: 'request-selection' }
  | { type: 'storage-get'; key: string; nonce: string }
  | { type: 'storage-set'; key: string; value: unknown }
  | { type: 'notify'; message: string; error?: boolean }
  | { type: 'resize'; width: number; height: number }
  | { type: 'zoom-to-selection' }
  | { type: 'close' }

/* ------------------------------------------------------------- sandbox → UI */

export interface SelectedSymbolInfo {
  nodeId: string
  nodeName: string
  /** current size on canvas, so a re-render can be produced at exactly this height */
  width: number
  height: number
  /** present when the node was created by this plugin */
  spec: SymbolSpec | null
}

export type PluginMessage =
  | {
      type: 'init'
      editorType: string
      command: string
      selection: SelectedSymbolInfo[]
      /** how many nodes are actually selected; `selection` may be a capped prefix */
      total: number
      fontsReady: boolean
      /** components and variants exist only on the Figma Design surface */
      canCreateComponents: boolean
    }
  | { type: 'selection'; selection: SelectedSymbolInfo[]; total: number }
  | { type: 'storage-value'; key: string; nonce: string; value: unknown }
  | { type: 'inserted'; count: number; failed: number }
  | { type: 'updated'; count: number }
  | { type: 'error'; message: string }

/** Key used for `setPluginData` round-tripping. */
export const PLUGIN_DATA_KEY = 'app6e'
