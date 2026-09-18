# What has been verified, and what has not

This plugin makes claims about a published military standard, so it is worth being precise
about which of those claims were tested and how. Everything below is reproducible with the
commands given.

## Verified by running code

| Claim | How |
|---|---|
| Every one of the 1 721 catalogue entities renders without throwing, producing a well-formed SVG with a finite view box and positive dimensions | `npm test` → `test/render.test.ts`, full-catalogue smoke render |
| The 30-digit SIDC round-trips: parse → format → parse is stable, and every field lands at its documented position | `test/sidc.test.ts` |
| Sector modifiers split correctly across positions 17-18 + 21 and 19-20 + 22 | `test/sidc.test.ts` |
| The frame-shape override survives a round-trip, including the non-numeric `A` (unframed) | `test/sidc.test.ts` |
| All seven standard identities produce visibly different frames | `test/render.test.ts`, affiliation sweep |
| Suspect symbols keep their amber fill despite the milsymbol version bug | `test/render.test.ts`, Suspect regression |
| The `standard: "APP6"` option really is in force — 152 of 1 721 entities differ from MIL-STD-2525E | `test/render.test.ts`, APP6-vs-2525 proof |
| The SVG handed to Figma uses only `svg`, `g`, `path` and `circle`, with a closed attribute set | `test/render.test.ts`, inventory sweep over 491 symbols; independently re-run over 4 956 |
| Amplifier text is stripped from the geometry and re-emitted as placements with finite coordinates inside the symbol bounds | `test/contract.test.ts` |
| A contrast outline does not duplicate amplifier text placements | `test/contract.test.ts` |
| Baking a target height into milsymbol's `size` hits the target within 0.5 px and preserves the aspect ratio | `test/render.test.ts` |
| Every one of the 231 presets renders real icon geometry, not a bare frame | `test/presets.test.ts` |
| ORBAT outlines parse, lay out without sibling overlap, and every connector ends exactly on a cell's top-edge centre | `test/orbat.test.ts`, `test/contract.test.ts` |
| The ORBAT connector SVG declares exactly the chart's own dimensions, so it lines up when the sandbox pins it at the origin | `test/contract.test.ts` |
| Symbols align on the octagon anchor, which stays at the frame centre even for headquarters symbols whose staff makes them taller | `research/scratch/mine/anchor.mjs` |
| A spec survives the plugin-data round trip and re-renders byte-identically | `test/contract.test.ts` |
| Preferences read back from storage are validated: an unknown colour mode, a zero symbol size, a colour that is not a colour and a bad layout are all rejected, while keys added in a later version are backfilled | `test/prefs.test.ts` |
| Every option in `SymbolStyle` and `InsertOptions` is actually read by the validator, so adding one without validating it fails the build | `test/prefs.test.ts`, the two coverage tests |
| `dist/code.js` contains no ES module syntax and `dist/ui.html` loads nothing remote | `npm run verify` |

## Verified against a stand-in for Figma

The sandbox half of the plugin normally has no coverage at all, because it only runs inside
Figma. `test/figma-stub.ts` is a small in-memory implementation of the parts of the plugin API
that `src/main/code.ts` touches — nodes, parenting, plugin data, fonts, components and the
postMessage channel. `test/sandbox.test.ts` loads the **built** `dist/code.js` into it and
drives the plugin through its real protocol, then asserts on the resulting node tree.

It is a stub, not an emulator: it models the behaviours that matter (a re-parent preserving
absolute position, a component being a different kind of node from a frame, text refusing to
accept characters before its font is loaded) and stubs the rest. What it does prove:

| Claim | Test |
|---|---|
| Inserting produces one frame per symbol, correctly named, with its spec in plugin data, its octagon anchor in shared plugin data, a relaunch button, no background and clipping off | `inserting builds one frame per symbol` |
| A grid lays out in real rows and columns with no overlap | `a grid lays out in rows and columns` |
| Each amplifier becomes exactly one text node, even with a contrast outline on | `amplifier text becomes real text nodes, once each` |
| The outline option leaves no live text behind | `outlined amplifier text leaves no live text behind` |
| When Arial and Helvetica are missing, the plugin falls back to a font it can actually load, and never writes to a text node before loading one | `the plugin falls back to a font it can actually load` |
| Component sets get one uniquely named variant per affiliation, with no `=` or `,` in a value | `a component set gets one uniquely named variant` |
| Re-rendering a symbol keeps its slot in the layer tree and its position | `re-rendering the selection keeps the node in its place` |
| **Re-rendering a component-ised symbol keeps it a component**, so its instances do not detach | `re-rendering a component-ised symbol keeps it a component` |
| Components and variants are refused outside Figma Design instead of throwing | `components are refused outside Figma Design` |
| A corrupt or partial stored spec is survived, not crashed on | `a corrupt or partial stored spec never crashes` |
| One malformed symbol in a batch is counted as failed, and the rest still insert | `a symbol that cannot be built is counted, not fatal` |
| A hundred-symbol batch completes and leaves no orphaned nodes | `a hundred-symbol batch completes` |
| The ORBAT payload becomes a chart with connectors, one symbol and one label per unit, all inside the chart bounds | `an ORBAT payload becomes a chart` |
| A re-render reaches the node it names, whatever order the selection is in, and leaves unnamed nodes alone | `an update reaches the node it names` |
| A large selection is reported as a capped list plus the true total, so the panel does not have to draw hundreds of thumbnails | `a huge selection is reported as a capped list` |
| "Insert as components" and "wrap in one frame" compose: the wrapper stays a frame and the symbols inside become components | `components and a wrapper frame compose` |
| Inserting into a selected frame puts the symbols inside it, positioned in its own coordinate space | `inserting into the selected frame` |

That last-but-one row is there because the stub caught a real defect: restyling a symbol that
had been inserted as a component replaced the main component with a plain frame, which would
have detached every instance of it in the file. The plugin now swaps a component's contents in
place instead, and skips instances with a message.

Run them all:

```bash
npm run build && npm run typecheck && npm test && npm run verify
```

## Verified by looking at it

The plugin UI is a self-contained HTML file, so it can be served and driven outside Figma.
Every tab was exercised this way — the builder, the preset shelf, the browse sheet, the batch
generators, the ORBAT chart and the settings — and the rendered symbology was checked by eye
against APP-6E: infantry, armour, artillery and engineer icons; echelon marks from platoon to
division; the headquarters staff; and all seven affiliation frames with their standard fills.

```bash
npm run build
python3 -m http.server 5178 --directory dist
# then open http://127.0.0.1:5178/ui.html
```

## Not verified

**The plugin has not been loaded into Figma.** Everything that depends on Figma's own
behaviour is therefore reasoned from the API typings and the platform research in
`research/04-figma-plugin-platform.md`, not observed:

- how `figma.createNodeFromSvg` maps our paths and circles to Figma nodes;
- whether anything is clipped despite `clipsContent = false`;
- the exact vertical placement of amplifier text, which approximates the glyph baseline at
  0.8 em below the top of the text box;
- `figma.combineAsVariants` behaviour with seven differently-sized affiliation variants;
- `figma.flatten` on amplifier text when the outline option is on;
- how a 500-symbol batch feels in a real document.

The stub tests exercise the plugin's own logic around all of these, but a stub can only be as
right as its author's understanding of Figma. Where the two disagree, Figma wins.

The riskiest of these was designed around rather than tested: `<text>` never reaches Figma's
SVG importer, because the importer resolves fonts on its own and can leave a text node with a
missing font, which is then unsafe to resize. The plugin strips the text in the UI and rebuilds
it with `figma.createText` after loading a font it has confirmed is available.

To check it yourself, in the Figma desktop app: **Plugins → Development → Import plugin from
manifest…**, choose `manifest.json`, then run the plugin and press **Insert symbol**. If the
symbol lands with its frame, icon and echelon intact, every assumption above held.

## Sources of the symbology

The plugin does not re-implement APP-6E from the published text. It composes two MIT-licensed
open-source projects and adds the SIDC model, the catalogue index, the Figma integration and
the tooling around them:

- **milsymbol 3.0.4** draws the symbols. It states support for MIL-STD-2525E and STANAG APP-6E.
- **milstandard-e 0.2.14** supplies the entity and modifier tables the picker searches.

Neither is an official NATO product, and neither is this plugin. Anything that has to be
authoritative should be checked against APP-6E itself.
