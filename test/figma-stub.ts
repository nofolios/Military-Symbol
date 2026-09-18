/**
 * A minimal, in-memory stand-in for the Figma plugin API.
 *
 * `src/main/code.ts` can only be exercised inside Figma, which means the half
 * of the plugin that actually creates nodes has no coverage at all. This stub
 * implements just the surface that file touches — enough to load the built
 * `dist/code.js`, drive it through the real postMessage protocol, and then
 * assert on the resulting node tree.
 *
 * It is deliberately not a Figma emulator. Where behaviour matters to the
 * plugin it is modelled faithfully (appendChild preserving absolute position,
 * components being distinct from frames, plugin data round-tripping); where it
 * does not, it is a stub.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

export type NodeType =
  | 'PAGE' | 'FRAME' | 'COMPONENT' | 'COMPONENT_SET' | 'GROUP'
  | 'TEXT' | 'VECTOR' | 'ELLIPSE' | 'INSTANCE'

/** The node types whose children are positioned relative to them. */
const COORDINATE_PARENTS = new Set<NodeType>(['FRAME', 'COMPONENT', 'COMPONENT_SET'])

export class StubNode {
  id: string
  type: NodeType
  name = ''
  x = 0
  y = 0
  width = 0
  height = 0
  fills: unknown[] = []
  strokes: unknown[] = []
  clipsContent = true
  visible = true
  removed = false
  parent: StubNode | null = null
  children: StubNode[] = []
  private pluginData = new Map<string, string>()
  private sharedPluginData = new Map<string, string>()
  relaunchData: Record<string, string> | null = null

  // text-only
  characters = ''
  fontName: unknown = null
  fontSize = 12
  textAutoResize = 'NONE'
  textAlignHorizontal = 'LEFT'

  // component-set-only
  layoutMode = 'NONE'
  itemSpacing = 0
  paddingLeft = 0
  paddingRight = 0
  paddingTop = 0
  paddingBottom = 0
  primaryAxisSizingMode = 'FIXED'
  counterAxisSizingMode = 'FIXED'
  counterAxisAlignItems = 'MIN'

  constructor(type: NodeType, id: string) {
    this.type = type
    this.id = id
  }

  /**
   * Absolute position.
   *
   * Only frames, components, component sets and sections establish a
   * coordinate system. A child of a group or a boolean operation keeps page
   * coordinates, exactly as the plugin typings describe, and modelling that
   * faithfully is the whole point of this stub.
   */
  absolute(): { x: number; y: number } {
    let x = this.x
    let y = this.y
    let p = this.parent
    let child: StubNode = this
    while (p && p.type !== 'PAGE') {
      if (COORDINATE_PARENTS.has(p.type)) {
        x += p.x
        y += p.y
      }
      child = p
      p = p.parent
    }
    void child
    return { x, y }
  }

  /**
   * Set by a harness built with `rejectAppend`, so one test can make a
   * container refuse children without the patch leaking into the next test in
   * the same process.
   */
  rejectAppend: ((container: StubNode, child: StubNode) => boolean) | null = null

  appendChild(child: StubNode) {
    if (child === this) throw new Error('cannot append a node to itself')
    if (this.type === 'VECTOR' || this.type === 'TEXT' || this.type === 'ELLIPSE') {
      throw new Error(`nodes of type ${this.type} cannot have children`)
    }
    if (this.rejectAppend && this.rejectAppend(this, child)) {
      // Figma's own wording for a reparent it will not perform.
      throw new Error('Reparenting nodes is subject to many restrictions')
    }
    const abs = child.absolute()
    child.detach()
    child.parent = this
    this.children.push(child)
    // Figma preserves a node's absolute position across a re-parent. Where the
    // new parent is a group the child's numbers stay in page coordinates, so
    // there is nothing to subtract.
    const here = COORDINATE_PARENTS.has(this.type) ? this.absolute() : { x: 0, y: 0 }
    child.x = abs.x - here.x
    child.y = abs.y - here.y
  }

  insertChild(index: number, child: StubNode) {
    this.appendChild(child)
    this.children.pop()
    this.children.splice(index, 0, child)
  }

  private detach() {
    if (this.parent) {
      const i = this.parent.children.indexOf(this)
      if (i >= 0) this.parent.children.splice(i, 1)
      this.parent = null
    }
  }

  remove() {
    this.detach()
    this.removed = true
  }

  resize(w: number, h: number) {
    if (w < 0.01 || h < 0.01) throw new Error('resize below the 0.01 minimum')
    this.width = w
    this.height = h
  }

  resizeWithoutConstraints(w: number, h: number) {
    this.resize(w, h)
  }

  rescale(scale: number) {
    if (scale < 0.01) throw new Error('rescale below the 0.01 minimum')
    this.width *= scale
    this.height *= scale
    for (const c of this.children) {
      c.x *= scale
      c.y *= scale
      c.rescale(scale)
    }
  }

  setPluginData(key: string, value: string) {
    if (value === '') this.pluginData.delete(key)
    else this.pluginData.set(key, value)
  }
  getPluginData(key: string): string {
    return this.pluginData.get(key) ?? ''
  }
  setSharedPluginData(ns: string, key: string, value: string) {
    this.sharedPluginData.set(`${ns}/${key}`, value)
  }
  getSharedPluginData(ns: string, key: string): string {
    return this.sharedPluginData.get(`${ns}/${key}`) ?? ''
  }
  setRelaunchData(data: Record<string, string>) {
    this.relaunchData = data
  }

  /** Every descendant, depth first. */
  descendants(): StubNode[] {
    const out: StubNode[] = []
    for (const c of this.children) {
      out.push(c)
      out.push(...c.descendants())
    }
    return out
  }

  find(predicate: (n: StubNode) => boolean): StubNode[] {
    return this.descendants().filter(predicate)
  }
}

export interface StubOptions {
  editorType?: string
  command?: string
  /** fonts `listAvailableFontsAsync` reports; the default is Figma's guaranteed set */
  fonts?: { family: string; style: string }[]
  /**
   * Make a container refuse children, to exercise the failure path. Applies to
   * every node this harness creates; the predicate picks the ones that refuse.
   */
  rejectAppend?: (container: StubNode, child: StubNode) => boolean
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface Harness {
  figma: Record<string, any>
  page: StubNode
  /** messages the plugin posted to the UI */
  posted: Record<string, any>[]
  notifications: { message: string; error: boolean }[]
  /** send a UI message into the plugin and wait for it to settle */
  send(msg: unknown): Promise<void>
  /** the last message of a given type, or undefined */
  lastPosted(type: string): Record<string, any> | undefined
  /** the last message of a given type; throws when the plugin never sent one */
  expectPosted(type: string): Record<string, any>
  /** set the page selection, firing the plugin's selectionchange handler */
  select(nodes: StubNode[]): void
  /** a node the plugin did not make, for testing that it is left alone */
  createForeignFrame(name?: string): StubNode
  /** the one node holding a given plugin-data spec, asserted to exist */
  ourNodes(): StubNode[]
  storage: Map<string, unknown>
  nodesCreated: StubNode[]
}

const PLUGIN_DATA_KEY = 'app6e'

const SVG_ROOT = /<svg\b([^>]*)>/
const SHAPE = /<(path|circle|ellipse|rect|line|polyline|polygon)\b/g

export function createHarness(opts: StubOptions = {}): Harness {
  let counter = 0
  const nextId = () => `S:${++counter}`
  const nodesCreated: StubNode[] = []

  const make = (type: NodeType) => {
    const n = new StubNode(type, nextId())
    if (opts.rejectAppend) n.rejectAppend = opts.rejectAppend
    nodesCreated.push(n)
    return n
  }

  const page = new StubNode('PAGE', 'PAGE:1')
  page.name = 'Page 1'
  if (opts.rejectAppend) page.rejectAppend = opts.rejectAppend

  const posted: Record<string, unknown>[] = []
  const notifications: { message: string; error: boolean }[] = []
  const storage = new Map<string, unknown>()
  let selection: StubNode[] = []
  let onmessage: ((msg: unknown) => unknown) | null = null
  const listeners: Record<string, ((...a: unknown[]) => void)[]> = {}

  const fonts = opts.fonts ?? [
    { family: 'Inter', style: 'Regular' },
    { family: 'Inter', style: 'Medium' },
    { family: 'Roboto', style: 'Regular' },
  ]
  const loadedFonts = new Set<string>()

  const parseColour = (css: string) => {
    const s = String(css).trim().toLowerCase()
    if (s === 'black') return { r: 0, g: 0, b: 0 }
    if (s === 'white') return { r: 1, g: 1, b: 1 }
    const rgb = s.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/)
    if (rgb) return { r: +rgb[1] / 255, g: +rgb[2] / 255, b: +rgb[3] / 255 }
    let hex = s.replace('#', '')
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('')
    if (/^[0-9a-f]{6}$/.test(hex)) {
      return {
        r: parseInt(hex.slice(0, 2), 16) / 255,
        g: parseInt(hex.slice(2, 4), 16) / 255,
        b: parseInt(hex.slice(4, 6), 16) / 255,
      }
    }
    throw new Error(`unparseable colour "${css}"`)
  }

  const figma: Record<string, unknown> = {
    editorType: opts.editorType ?? 'figma',
    command: opts.command ?? '',
    apiVersion: '1.0.0',
    root: page,

    get currentPage() {
      return pageProxy
    },

    showUI() {
      /* no window in a test */
    },

    on(event: string, fn: (...a: unknown[]) => void) {
      ;(listeners[event] ??= []).push(fn)
    },

    ui: {
      postMessage(msg: Record<string, unknown>) {
        posted.push(msg)
      },
      set onmessage(fn: (msg: unknown) => unknown) {
        onmessage = fn
      },
      get onmessage() {
        return onmessage as (msg: unknown) => unknown
      },
      resize() {},
    },

    notify(message: string, options?: { error?: boolean }) {
      notifications.push({ message, error: Boolean(options && options.error) })
      return { cancel() {} }
    },

    closePlugin() {},

    viewport: {
      center: { x: 0, y: 0 },
      zoom: 1,
      scrollAndZoomIntoView() {},
    },

    clientStorage: {
      async getAsync(key: string) {
        return storage.get(key)
      },
      async setAsync(key: string, value: unknown) {
        storage.set(key, value)
      },
    },

    util: { rgb: parseColour },

    async loadFontAsync(font: { family: string; style: string }) {
      if (!fonts.some(f => f.family === font.family && f.style === font.style)) {
        throw new Error(`font ${font.family} ${font.style} is not available`)
      }
      loadedFonts.add(`${font.family}|${font.style}`)
    },

    async listAvailableFontsAsync() {
      return fonts.map(f => ({ fontName: f }))
    },

    createFrame() {
      const n = make('FRAME')
      n.name = 'Frame'
      n.width = 100
      n.height = 100
      n.clipsContent = true
      page.appendChild(n)
      return n
    },

    createComponent() {
      const n = make('COMPONENT')
      n.name = 'Component'
      n.width = 100
      n.height = 100
      page.appendChild(n)
      return n
    },

    createText() {
      const n = make('TEXT')
      n.name = 'Text'
      n.width = 0
      n.height = 0
      // Writing characters before a font is loaded is a hard error in Figma.
      const guard = {
        get: (t: StubNode, prop: string) => Reflect.get(t, prop),
        set: (t: StubNode, prop: string, value: unknown) => {
          if ((prop === 'characters' || prop === 'fontSize' || prop === 'textAutoResize')) {
            const fn = t.fontName as { family: string; style: string } | null
            if (!fn || !loadedFonts.has(`${fn.family}|${fn.style}`)) {
              throw new Error(`cannot set ${prop} before loadFontAsync`)
            }
          }
          Reflect.set(t, prop, value)
          if (prop === 'characters' || prop === 'fontSize') {
            // A crude but monotonic text metric, enough to test placement maths.
            t.width = String(t.characters).length * t.fontSize * 0.55
            t.height = t.fontSize * 1.2
          }
          return true
        },
      }
      page.appendChild(n)
      return new Proxy(n, guard)
    },

    createNodeFromSvg(svg: string) {
      if (typeof svg !== 'string' || !SVG_ROOT.test(svg)) throw new Error('malformed SVG')
      const attrs = svg.match(SVG_ROOT)![1]
      const width = Number((attrs.match(/width="([\d.]+)"/) || [])[1] || 0)
      const height = Number((attrs.match(/height="([\d.]+)"/) || [])[1] || 0)
      const frame = make('FRAME')
      frame.name = 'svg'
      frame.width = width
      frame.height = height
      frame.clipsContent = true
      SHAPE.lastIndex = 0
      let m: RegExpExecArray | null
      while ((m = SHAPE.exec(svg))) {
        const child = make(m[1] === 'circle' || m[1] === 'ellipse' ? 'ELLIPSE' : 'VECTOR')
        child.name = m[1]
        frame.appendChild(child)
      }
      // Figma's importer never produces text nodes we can rely on, and this
      // plugin strips text before calling it, so the stub creates none either.
      page.appendChild(frame)
      return frame
    },

    combineAsVariants(components: StubNode[], parent: StubNode) {
      if (!Array.isArray(components) || components.length === 0) {
        throw new Error('combineAsVariants needs at least one component')
      }
      for (const c of components) {
        if (c.type !== 'COMPONENT') throw new Error('combineAsVariants: not a component')
      }
      const names = components.map(c => c.name)
      if (new Set(names).size !== names.length) {
        throw new Error('combineAsVariants: duplicate variant names')
      }
      const set = make('COMPONENT_SET')
      set.name = 'Component Set'
      parent.appendChild(set)
      let x = 0
      for (const c of components) {
        set.appendChild(c)
        c.x = x
        c.y = 0
        x += c.width + 24
      }
      set.width = Math.max(1, x - 24)
      set.height = Math.max(1, ...components.map(c => c.height))
      return set
    },

    flatten(nodes: StubNode[], parent?: StubNode) {
      const first = nodes[0]
      const flat = make('VECTOR')
      flat.name = first.name
      flat.x = first.x
      flat.y = first.y
      flat.width = first.width
      flat.height = first.height
      ;(parent ?? first.parent ?? page).appendChild(flat)
      for (const n of nodes) n.remove()
      return flat
    },
  }

  // currentPage needs a settable `selection`, so it is proxied rather than
  // exposed directly.
  const pageProxy = new Proxy(page, {
    get(target, prop) {
      if (prop === 'selection') return selection
      const value = Reflect.get(target, prop)
      return typeof value === 'function' ? value.bind(target) : value
    },
    set(target, prop, value) {
      if (prop === 'selection') {
        selection = value as StubNode[]
        for (const fn of listeners.selectionchange ?? []) fn()
        return true
      }
      return Reflect.set(target, prop, value)
    },
  })

  return {
    figma,
    page,
    posted,
    notifications,
    storage,
    nodesCreated,
    async send(msg: unknown) {
      if (!onmessage) throw new Error('the plugin never registered figma.ui.onmessage')
      await onmessage(msg)
      // Let any queued microtasks and the plugin's own yields drain.
      for (let i = 0; i < 40; i++) await new Promise(r => setTimeout(r, 0))
    },
    lastPosted(type: string) {
      for (let i = posted.length - 1; i >= 0; i--) {
        if (posted[i].type === type) return posted[i]
      }
      return undefined
    },
    expectPosted(type: string) {
      for (let i = posted.length - 1; i >= 0; i--) {
        if (posted[i].type === type) return posted[i]
      }
      throw new Error(
        `the plugin never posted a "${type}" message; it posted: ${posted.map(p => p.type).join(', ') || '(nothing)'}`
      )
    },
    select(nodes: StubNode[]) {
      selection = nodes
      for (const fn of listeners.selectionchange ?? []) fn()
    },
    createForeignFrame(name = 'Someone else') {
      const n = make('FRAME')
      n.name = name
      n.width = 50
      n.height = 50
      page.appendChild(n)
      return n
    },
    ourNodes() {
      return page.descendants().filter(n => n.getPluginData(PLUGIN_DATA_KEY) !== '')
    },
  }
}

const HERE = dirname(fileURLToPath(import.meta.url))

/**
 * The bundle is read at run time rather than imported, because it is a classic
 * script that expects `figma` as a global. Tests run from `dist/test/`, so the
 * project root is found by walking up until `manifest.json` appears.
 */
function sandboxBundlePath(): string {
  const candidates = [
    join(process.cwd(), 'dist', 'code.js'),
    join(HERE, 'code.js'),
    join(HERE, '..', 'code.js'),
    join(HERE, '..', 'dist', 'code.js'),
    join(HERE, '..', '..', 'dist', 'code.js'),
  ]
  for (const c of candidates) {
    if (existsSync(c)) return c
  }
  throw new Error(
    'dist/code.js was not found. Run `npm run build` before the sandbox tests. Looked in:\n  ' +
      candidates.join('\n  ')
  )
}

/** Load the built sandbox bundle against a fresh stub. */
export function loadPlugin(opts: StubOptions = {}): Harness {
  const harness = createHarness(opts)
  const bundle = readFileSync(sandboxBundlePath(), 'utf8')
  const context = vm.createContext({
    figma: harness.figma,
    __html__: '<html></html>',
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    Promise,
    JSON,
    Math,
    Object,
    Array,
    String,
    Number,
    Boolean,
    Error,
    Map,
    Set,
    RegExp,
    Date,
    isNaN,
    isFinite,
    parseInt,
    parseFloat,
    Symbol,
    Proxy,
    Reflect,
  })
  vm.runInContext(bundle, context, { filename: 'dist/code.js' })
  return harness
}
