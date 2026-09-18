# Development

How to build, run, test, debug and package **Military Symbols**, a Figma plugin that
generates NATO APP-6E (STANAG 2019 Ed. E) military map symbols.

Everything here assumes the repository root:

```sh
cd "app6e-figma-plugin"
npm install
```

Node 20 or newer (the tests are bundled for `node20` and run under `node --test`). No global tools
are needed; `esbuild` and `typescript` come from `devDependencies`.

---

## 1. The commands

| Command | What it does |
|---|---|
| `npm run build:catalog` | Regenerates `src/data/catalog.json` from the `milstandard-e` TSV tables. |
| `npm run build` | `build:catalog`, then `dist/code.js` and `dist/ui.html`. |
| `npm run watch` | Rebuilds both artefacts on every source change. No catalogue rebuild. |
| `npm run typecheck` | `tsc --noEmit` over three projects: the UI, the sandbox, and the tests. |
| `npm test` | Bundles `test/*.test.ts` with esbuild, then runs `node --test` over the bundles. |
| `npm run verify` | Preflight: would this actually load in Figma? |
| `npm run preview` | Regenerates `assets/preview.svg`, the contact sheet the README shows. |
| `npm run package` | `build`, then `verify`, then `dist/military-symbols.zip`. |

`npm run build` emits exactly two artefacts, and they are the only two things Figma reads:

* **`dist/code.js`** — the sandbox bundle. An **IIFE**, ES2017, no DOM, no modules.
* **`dist/ui.html`** — one self-contained file with the UI's JS and CSS inlined into
  `src/ui/index.html` (the `/* __JS__ */` and `/* __CSS__ */` placeholders). It is ~1.18 MiB, most
  of it the bundled catalogue and milsymbol.

Both constraints are load-bearing, and `npm run verify` enforces them — see §6.

---

## 2. Loading the plugin into Figma

1. `npm run build` (Figma loads files from disk; it does not build anything for you).
2. In the **Figma desktop app**, open any Design file.
3. Menu bar: **Plugins → Development → Import plugin from manifest…**
   (or right-click the canvas → **Plugins → Development → Import plugin from manifest…**)
4. Pick `manifest.json` at the repository root.
5. The plugin now appears under **Plugins → Development → Military Symbols**.

You import the manifest **once**. After that:

* Change some source, let `npm run watch` rebuild, then **re-run the plugin** — Figma re-reads
  `dist/code.js` and `dist/ui.html` from disk on every launch. There is no hot reload.
* **Cmd/Ctrl + Alt/Option + P** re-runs the last plugin. This is the whole edit loop.

`manifest.json` declares `"editorType": ["figma"]` and nothing else. Components, component sets
and variants are Figma Design concepts, and `createComponent` / `combineAsVariants` throw in
FigJam and Slides; `canCreateComponents()` in `src/main/code.ts` still guards them at runtime,
and `npm run verify` warns as soon as the manifest lists any other editor while those calls are
in the bundle (it looks for the call, not for the guard).

Two deliberate omissions in `manifest.json`:

* No `"build"` field. It would make Figma shell out on every single launch. Run `npm run watch` in a
  terminal instead (`research/04-figma-plugin-platform.md` §1.1).
* No `"enableProposedApi"`. It breaks publishing; `verify` fails the build if it ever appears.

The browser version of Figma can run development plugins too, but the desktop app is what you want:
it reads the manifest straight off the filesystem and gives you the plugin console (§5).

---

## 3. Repository layout

```
build/
  build-catalog.mjs     milstandard-e TSV tables  ->  src/data/catalog.json
  build.mjs             esbuild: dist/code.js + dist/ui.html   (--watch, --dev)
  build-test.mjs        esbuild: test/*.test.ts   ->  dist/test/*.test.mjs
  verify-manifest.mjs   preflight; also exports verifyManifest() for package.mjs
  make-preview.mjs      assets/preview.svg, the README contact sheet
  package.mjs           dist/military-symbols.zip
src/
  core/                 pure, no DOM, no Figma, no milsymbol
    sidc.ts             the 30-digit SIDC model + every enumeration
    catalog.ts          typed access to the generated catalogue + entity search
    orbat.ts            indented outline -> tree -> tidy layout + connectors
  data/
    catalog.json        generated — do not edit by hand
    presets.ts          231 curated SIDCs, verified by test/presets.test.ts
  shared/messages.ts    the UI <-> sandbox postMessage protocol and domain types
  ui/                   Preact UI; the ONLY half that may import milsymbol
    render.ts           the milsymbol wrapper + AMPLIFIER_FIELDS
    orbat-payload.ts    renders an orbat.ts layout into an OrbatPayload
    app.tsx store.ts preview.tsx components.tsx bridge.ts index.tsx
    panes/              build, browse, batch, orbat, selection, settings, presets
    index.html          template with the /* __JS__ */ and /* __CSS__ */ slots
  main/code.ts          the Figma sandbox; never imports milsymbol or the catalogue
test/                   node:test + node:assert/strict, bundled by build-test.mjs
                        one suite per concern: sidc, catalog, render, presets, orbat, …
assets/preview.svg      generated by `npm run preview`
research/               the design record — read before changing behaviour
docs/DEVELOPMENT.md     this file
dist/                   build output; git-ignored
```

The split that matters: **rendering happens in the UI, node creation happens in the sandbox.**
`src/ui/render.ts` runs milsymbol in the iframe and posts finished, text-free SVG plus the amplifier
text as structured data; `src/main/code.ts` turns that into Figma nodes and knows nothing about
APP-6E. Keep it that way — milsymbol needs DOM-ish globals the sandbox does not have, and the
sandbox has APIs the iframe does not.

`tsconfig.ui.json` and `tsconfig.main.json` exist to police exactly this boundary: the sandbox
project has `@figma/plugin-typings` and no DOM lib, the UI project has DOM and no `figma` global.
A third project, `tsconfig.test.json`, covers `test/**` plus the sources the suites reach into
(`src/core`, `src/shared`, `src/data` and `src/ui/render.ts`). It is the only project with
`@types/node`, and it turns `isolatedModules` off, because the tests import types across files
freely. `npm run typecheck` runs all three, and all three extend `tsconfig.base.json`.

---

## 4. The catalogue

`src/data/catalog.json` is **generated**. Never edit it; edit the generator.

`build/build-catalog.mjs` reads the MIT-licensed `milstandard-e` TSV tables from
`node_modules/milstandard-e/tsv-tables/` and emits one minified JSON file (299 KiB, 20 symbol
sets, 1 721 entity codes — 1 674 of them selectable, 47 withdrawn — and 2 835 sector modifiers)
that esbuild inlines into `dist/ui.html` through its `json` loader. `src/core/catalog.ts` is the
only thing that imports it, and it exports the two counts the Settings pane prints:
`catalogSize` (every code) and `searchableCount` (everything not `{Disused}`).

Three things the generator does that are easy to miss:

* **Hierarchy carry-forward.** The entity tables encode Entity / Entity Type / Entity Subtype by
  leaving higher-level cells blank on continuation rows. The generator carries the last non-empty
  value at each level forward and resets deeper levels when a shallower one changes; the surviving
  path is `entity.p` and the leaf name is `entity.n`.
* **Modifier merge.** Per-set sector tables are merged over `Common Modifiers sector 1/2`, and the
  set-specific entry wins on a code collision.
* **Duplicate guard.** Duplicate entity codes within a set are reported as `! duplicate codes in
  set NN`. If you see that line, the TSV mapping is wrong.

### Adding a symbol set

1. Confirm the set exists in the source data: `ls node_modules/milstandard-e/tsv-tables/`. You need
   `<Base>.tsv`, and optionally `<Base> sector 1.tsv` and `<Base> sector 2.tsv`.
2. Add a row to `SYMBOL_SETS` in `build/build-catalog.mjs`, in display order:

   ```js
   { code: '45', name: 'Some Set', tsv: 'Some set', dimension: 'Ground', group: 'Land' },
   ```

   * `code` is the **real APP-6E symbol-set number** — it lands verbatim at SIDC positions 5-6
     (`src/core/sidc.ts`), so inventing one produces symbols that no other tool will read.
   * `tsv` is the TSV base name, spelled exactly as the file is (including its capitalisation).
   * `dimension` and `group` only drive grouping in the UI's browse pane.
3. `npm run build:catalog`. Read the per-set line it prints:
   `set 45 Some Set   entities= 137 (disused   4) m1= 12 m2=  8`.
   **`entities=0` means the `tsv` name did not match a file** — the generator returns an empty list
   rather than throwing. The `disused` count is the `{Disused}` placeholders the standard has
   withdrawn; they are flagged `d: 1`, kept so old SIDCs still decode, and filtered out of
   search by `searchEntities()`.
4. `npm test && npm run build`. The UI picks the set up automatically through `symbolSets`.

Note that a set appearing in the catalogue does not mean milsymbol can *draw* every entity in it.
Measured with `hasIconGeometry()` over every non-withdrawn entity, coverage is 1 026 / 1 053
(97.4 %) outside symbol set 25; `research/03-catalog-data.md` §5 has the per-set breakdown.
`hasIconGeometry()` in `src/ui/render.ts` is the runtime check, and the Browse tab's *Hide codes
with no icon* toggle is it in the UI.

Symbol set 25 is its own case: every entity there draws *something*, but roughly half of them are
not point symbols at all. `entity.g` carries the standard's "Geometric Rendering" column — `Point`
(254), `Line` (95), `Area` (195), `Axis` (5), `Corridor` (7), absent (72) — and the preview in
`src/ui/preview.tsx` turns anything other than `Point` into a *"… graphic"* pill, because the
plugin only ever inserts point symbols.

### The ORBAT module

`src/core/orbat.ts` is pure and has no idea milsymbol or Figma exist, which is why the whole of
`test/orbat.test.ts` runs in Node. It is three steps:

1. `parseLine()` splits `Label | directive | directive` into tokens. A directive is a full SIDC
   (20+ digits), an echelon name or two-digit code, an affiliation name or single digit, a
   six-digit entity code, `hq` or `tf`; anything else is collected in `unknownTokens` and
   surfaced in the pane as a per-line problem rather than silently dropped.
2. `parseOrbat()` builds the forest. Indentation is compared against the stack of open ancestors
   (`indentWidth()` counts a tab as two spaces), so 2-space, 4-space and tab outlines all parse.
   Each node inherits its **parent's finished SIDC** and then applies its own directives; the
   HQ/TF digit is the one field that is reset rather than inherited, because an inherited
   headquarters flag would mark every subordinate as a headquarters too.
3. `layoutOrbat()` does a tidy top-down tree layout: leaves take one cell, parents are centred
   over their children's span, and connectors come out as orthogonal polylines. A parent narrower
   than its subtree can be placed at a negative x, so the layout normalises to (0, 0) at the end —
   do not remove that pass.

`src/ui/orbat-payload.ts` is the only part that renders: it turns the layout into an
`OrbatPayload` (one `RenderedSymbol` per unit, one placement per cell, and every connector as a
single SVG document), which `insertOrbat()` in `src/main/code.ts` places. Every symbol in a chart
is rendered at the same milsymbol `size` rather than the same total height, so a headquarters
staff grows the symbol instead of shrinking its frame.

---

## 5. Debugging

### The plugin console

**Plugins → Development → Open console** (desktop app) shows everything the sandbox logs —
every `console.log` / `console.error` in `src/main/code.ts`, including the per-symbol
`'Failed to build symbol', <sidc>, <error>` lines that `insertSymbols` emits when
`createNodeFromSvg` rejects a symbol. Open it *before* running the plugin; it does not backfill.

While a plugin is running, that console evaluates against the sandbox realm, so `figma` is in scope:

```js
figma.currentPage.selection[0].getPluginData('app6e')
```

### Inspecting what the plugin stored on a node

Every node the plugin creates carries its own recipe:

* `node.getPluginData('app6e')` → the JSON-encoded `SymbolSpec` (`PLUGIN_DATA_KEY` is `'app6e'`,
  defined in `src/shared/messages.ts`). This is what the selection pane reads back and what
  "re-render selected" replays. A node without it is not ours and is skipped.
* `node.getSharedPluginData('app6e', 'anchor')` → the symbol's anchor point, when one was recorded.
* `node.setRelaunchData({ edit: … })` is what surfaces the **Edit APP-6E symbol** button in the
  right-hand panel; the `edit` command is declared in `manifest.json` under `relaunchButtons`.

So the fastest way to answer "why did this symbol come out wrong" is to select it, read its
`getPluginData('app6e')`, and feed that SIDC back through `render()` in a test.

### Debugging the UI without Figma

The UI half is a plain web page and `src/core/*` is pure, so most bugs are reachable from Node.
`test/*.test.ts` are bundled by esbuild before `node --test` runs them, which means **a test may
import TypeScript source directly, including `src/ui/render.ts` and `src/data/catalog.json`**:

```ts
import { render, renderingSidc } from '../src/ui/render'
```

That is much faster than round-tripping through the editor. Reach for the Figma app only for things
that are genuinely about node creation: SVG import, fonts, layout, components.

### The two rules that bite hardest

Both are settled; see `research/02-milsymbol-api.md` §3.6 (version 13 vs 14) and the
`standard` row of its options table — any value other than `"APP6"`, including `"APP6E"`, is
treated as 2525.

1. **Always call `renderingSidc()` before handing a SIDC to milsymbol.** The plugin emits version
   digits `"14"` (APP-6E). milsymbol 3.0.4 tests its Suspect-colour rule with `version == 13`
   (numeric), so a `"14"` SIDC silently loses Suspect amber. `renderingSidc()` rewrites the leading
   `"14"` to `"13"` **for rendering only** — the two versions are otherwise identical, both mapping
   to milsymbol edition `"E"`. User-facing SIDCs stay `"14"`.
2. **Always set `standard: "APP6"` in the render options.** APP-6 versus MIL-STD-2525 glyphs come
   from that option, *not* from the SIDC. milsymbol defaults to US 2525 glyphs, so a missing option
   produces the wrong icon with no error.

Related: sector modifiers are three-digit codes — SIDC position 21 + positions 17-18 for sector 1,
and position 22 + positions 19-20 for sector 2 (`src/core/sidc.ts`).

### SVG import gotchas

`figma.createNodeFromSvg()` is synchronous, returns a `FrameNode` already parented to the current
page, and throws on malformed XML. `research/04-figma-plugin-platform.md` §2 has the full
element-by-element status table. The ones that shaped `src/main/code.ts`:

* **Text never goes through the importer.** Figma's SVG importer resolves fonts itself and can leave
  you with text in a missing font, which is then unsafe to resize. So the UI strips `<text>` into a
  `TextPlacement[]` (`extractText` in `render.ts`) and posts `geometrySvg`; the sandbox recreates
  each label with `figma.createText()` after `loadFontAsync`. If an amplifier ever comes back as a
  grey missing-font box, something put text back into the SVG.
* **Baselines shift.** SVG positions text by its glyph baseline, Figma by the top of the text box.
  `addTextAmplifiers` approximates the baseline at `0.8 em` below the box top, which holds for Latin
  text in Inter, Arial and Roboto. `dominant-baseline` has no Figma equivalent and is dropped.
* **`clipsContent` must be `false`.** milsymbol viewBoxes routinely have a negative origin, and
  amplifiers and movement arrows overhang the frame bounds. The imported frame would clip them.
* **Symbols are rendered at final size by the UI**, so nothing in the sandbox ever rescales
  geometry — that is what keeps stroke weights correct. Resize by re-rendering, not by scaling.
* **A degenerate symbol means a bad SIDC, not a bad importer.** A SIDC with no icon geometry yields
  a ~0x0 frame; `buildSymbolNode` removes it and throws, and the insert is counted in `failed`.
  Check `hasIconGeometry()` first.
* **Do not strip `xmlns`** from milsymbol's output. `stroke-dasharray` (pending, assumed, suspect,
  planned and feint frames) does survive as `dashPattern`, so dashed frames are expected to work.
* **Variant property values cannot contain `=` or `,`** — `sanitiseVariantValue` in `code.ts`
  replaces them before `combineAsVariants`.

### Manifest and API surface

`documentAccess: "dynamic-page"` is mandatory for new plugins, and it makes a list of synchronous
getters **throw** (`figma.getNodeById`, `figma.getStyleById`, the `getLocal*Styles` family, …) and a
list of properties read-only (`figma.currentPage`, `node.fillStyleId`, …). The full table is
`research/04-figma-plugin-platform.md` §1.3. This plugin only writes into `figma.currentPage`, which
is always loaded, so it needs no `loadAllPagesAsync()` on the happy path — do not add one casually,
it is the expensive call the Figma docs explicitly discourage.

`networkAccess.allowedDomains: ["none"]` blocks the **iframe** as well as the sandbox. A remote
`<script src>`, `<link rel="stylesheet">` or webfont in the UI does not warn, it simply never loads.
Everything must be inlined into `dist/ui.html`.

---

## 6. Verifying and packaging

### `npm run verify`

`build/verify-manifest.mjs` is the preflight that catches, in about 50 ms, the failures that
otherwise cost a full import-and-run cycle in the editor:

* `manifest.json` parses, and every required field is present and correctly typed —
  `name`, `id`, `api` (must be exactly `"1.0.0"`), `main`, `editorType` (from
  `figma | figjam | dev | slides | buzz`), `documentAccess` (must be `"dynamic-page"`) and
  `networkAccess.allowedDomains`. `capabilities`, `permissions`, `menu` and `relaunchButtons` are
  checked against their enumerations and shapes when present, `reasoning` is required for a `"*"` or
  localhost domain, and unknown keys are warned about as likely typos. Field list:
  `research/04-figma-plugin-platform.md` §1.1.
* `main` and `ui` resolve to files that exist **after a build**, are relative, and are non-empty.
* `dist/code.js` contains no top-level `import` / `export` — the Figma sandbox has no module loader,
  so the bundle must stay an IIFE.
* `dist/ui.html` is fully self-contained: no `<script src=>`, no `<link rel="stylesheet">`, no
  remote `src`/`href`, no CSS `@import` of a remote sheet.
* If `editorType` lists anything besides `figma` while `dist/code.js` calls a Figma Design-only API
  (`createComponent`, `combineAsVariants`), you get a warning — those calls throw in FigJam and
  Slides, and nothing in the manifest tells you so. Guard them behind
  `figma.editorType === 'figma'`, or drop the extra editors
  (`research/04-figma-plugin-platform.md` §1.4).
* Every artefact's byte size is reported, with a warning above 4 MB.

It exits non-zero on any failure, so it is safe in CI or a pre-commit hook. `--root <dir>` points it
at another directory, `--quiet` suppresses the per-artefact lines.

```
$ npm run verify
verify-manifest: checking plugin artefacts
  ok   manifest.json                 593 B
  ok   main (dist/code.js)         9.4 KiB
  ok   ui (dist/ui.html)          1.18 MiB

verify-manifest: OK
```

That run is clean because `editorType` is `["figma"]`. Widen it and the Design-only API check
fires instead:

```
  WARN dist/code.js calls Figma Design-only API(s) (createComponent, combineAsVariants) but
       editorType also lists figjam, slides — guard those calls behind `figma.editorType === 'figma'`
```

### `npm run package`

`build/package.mjs` produces `dist/military-symbols.zip` for anyone who should install the
plugin without cloning the repository. It runs the same verification first (it imports
`verifyManifest()` rather than re-implementing it), refuses to package anything that fails, then
stages a **flat** copy in `dist/package/`:

```
manifest.json      main/ui rewritten to "code.js" / "ui.html"
code.js
ui.html
LICENSE, THIRD-PARTY.md   (only if they exist at the repository root)
```

The rewrite is the point: unzip the archive into a folder and **Import plugin from manifest…**
accepts it as-is, with no `dist/` subdirectory to recreate. The staged folder is left on disk, so
you can import `dist/package/manifest.json` directly to test the flattened layout. The staged tree
is verified a second time, which catches a rewrite pointing at a file that was not copied.

Archiving shells out to the system `zip` through `node:child_process` (`-q -X`); the project has no
archiving dependency and is not gaining one. If `zip` is missing, the script says so, names the
staged folder you can compress by hand, and exits 1.

```
$ npm run package
...
package: not present, skipped: LICENSE.md

Packaged:
  LICENSE                       1.1 KiB
  THIRD-PARTY.md                3.2 KiB
  code.js                       9.4 KiB
  manifest.json                   577 B
  ui.html                      1.18 MiB
  -------------------------------------
  military-symbols.zip  258.0 KiB  compressed
```

A `package: not present, skipped: …` line is informational: the staging step looks for a short
list of root documents and copies the ones that exist.

### `npm run preview`

`build/make-preview.mjs` writes `assets/preview.svg`, the contact sheet the README opens with —
55 symbols in seven sections, spanning the symbol sets, the seven affiliations, the echelon
ladder and the status / HQ digits.

It is not a screenshot. It drives milsymbol exactly as `src/ui/render.ts` does — `setStandard`
`'APP6'`, the `"14"` → `"13"` rewrite, the `FrameColor.Suspect` `rbg` repair — and places each
symbol on its octagon anchor the way `centreOnAnchor()` does in the sandbox, so a row of mixed
frames lines up in the picture for the same reason it lines up on the canvas. Before writing it
checks every code: 30 digits, version `14`, `isValid()`, and real icon geometry. A failure prints
the offending label and exits non-zero without touching the file, so a milsymbol upgrade that
drops an icon cannot quietly gut the README's picture.

`--out <file>` writes somewhere else, which is handy for eyeballing a change before committing
it. The sheet's content is the `SECTIONS` array at the top of the script; keep it wide rather
than deep, the spread across sets and identities is the point of the picture.

---

## 7. Before you push

```sh
npm run typecheck && npm test && npm run package
```

`typecheck` covers all three TypeScript projects, `test` is `node --test` over the bundled
suites, and `package` re-runs the build and the manifest preflight on the way to the archive. All
three must be clean.

Add `npm run preview` when you have touched `src/ui/render.ts`, `src/data/presets.ts` or the
catalogue: `assets/preview.svg` is committed, so a rendering change that does not regenerate it
leaves the README showing the old symbols.

## Styling

`src/ui/styles.css` holds the Nofolios brand tokens. Change a colour there and the whole
panel follows: the tokens are the only place a hex value appears.

The panel is deliberately light only and does not read Figma's `--figma-color-*` theme
variables, which is why `figma.showUI` is called without `themeColors`. If a dark variant is
ever wanted, the cheapest route is a second `:root` block under
`@media (prefers-color-scheme: dark)` redefining the same tokens, since nothing outside that
block hard-codes a colour.

The brandmark lives in `src/ui/brand.tsx` as inline SVG, so the panel loads no external
assets and the manifest can keep `networkAccess: none`.
