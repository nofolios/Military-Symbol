# milsymbol 3.0.4 — Complete API Reference for the APP‑6E Figma Plugin

**Status:** every claim below was verified against the installed source at
`node_modules/milsymbol` (v3.0.4, MIT)
and/or by running code in plain Node v24.19.0. Claims that could **not** be verified locally are
explicitly tagged `[UNVERIFIED]`.

Probe scripts live in `research/scratch/`.

| Verification legend | Meaning |
|---|---|
| **[src]** | read directly in `node_modules/milsymbol/src/...` |
| **[run]** | proven by executing code in Node with no DOM polyfill |
| **[ext]** | external documentation only |
| **[UNVERIFIED]** | could not confirm here — must be checked in the Figma runtime |

---

## 0. Package layout, entry points and bundle budget

| Field in `package.json` | Value | Consequence |
|---|---|---|
| `type` | `module` | source is ESM |
| `main` (require) | `./dist/milsymbol.js` | minified CJS, **861 713 bytes** |
| `module` / `import` | `./index.js` | ESM, pulls in *all* editions |
| `browser` | `./dist/milsymbol.js` | **bundlers targeting the browser pick the 862 KB CJS build** |
| `types` | `./index.d.ts` | hand-written; `SymbolOptions` is missing `styleFill`, `country_flag`, `full_frame_flag` and `signature`, and declares `stack` (correctly — it is read at runtime but not declared in the constructor) **[run]** |
| `exports` | only `"."` and `"./package.json"` | **subpath imports are blocked** |

```js
import ms from "milsymbol";            // default export: the `ms` singleton with ALL icon sets loaded
const sym = new ms.Symbol(sidc, opts); // ms.Symbol is a constructor property of that singleton
```

`index.js` **[src]** does exactly this:

```js
import { ms, app6b, std2525b, std2525c, app6d, std2525d, std2525e, path2d } from "./index.mjs";
ms.addIcons(app6b); ms.addIcons(std2525b); ms.addIcons(std2525c);
ms.addIcons(app6d); ms.addIcons(std2525d); ms.addIcons(std2525e);
ms.Path2D = path2d;
export default ms;
```

### 0.1 Tree-shaking (measured with the repo's own esbuild) **[run]**

| Entry | esbuild `--bundle --minify --format=esm` |
|---|---|
| `import ms from "milsymbol"` (default) | **862 446 B** |
| `import ms from ".../milsymbol/index.js"` | 862 446 B |
| `import { ms, std2525e } from ".../milsymbol/index.mjs"` + `ms.addIcons(std2525e)` | **685 944 B** |
| `import { ms, numberlandunit, numberlandequipment }` + `addIcons` each | **455 107 B** |

**Gotcha:** `import { ms, std2525e } from "milsymbol/index.mjs"` **fails to resolve** — the `exports`
map does not expose `./index.mjs`. You must import the file by relative path
(`../../node_modules/milsymbol/index.mjs`) or add an alias in your bundler config. **[run]**

For an APP‑6E-only plugin, `std2525e` is the only icon pack you need — it serves both 2525E and
APP‑6E (there is no separate `app6e` export; the standard is a *render-time* switch, see §3).

### 0.2 Load-time side effect **[src]** `src/ms.js:1-12`

```js
if (typeof console === "object" && typeof process !== "object") { console.info("milsymbol.js 3.0.4 - Copyright ..."); }
```

In a Figma plugin **UI iframe** `process` is undefined, so the banner **is** printed to the console on
import. Harmless, but noisy; suppress by shimming `globalThis.process = {}` before import if desired.

---

## 1. Constructor: `new ms.Symbol(sidc, options, …)`

### 1.1 Signature and argument handling **[src]** `src/ms/symbol.js`, `src/ms/symbol/setoptions.js`

```ts
new ms.Symbol(...args: (string | object)[])   // any number of args, applied left→right
sym.setOptions(...args)                       // same handling, returns `this` (chainable)
```

Rules from `setOptions` **[src] [run]**:

1. A **non-object** argument is assigned to `options.sidc` (so `new ms.Symbol("1403…")` works).
2. For an object argument, each key is tested with `this.style.hasOwnProperty(key)`:
   * key exists on `style` → written to `this.style`
   * otherwise → written to `this.options` (**unknown keys are silently accepted**, e.g. `{fooBar:1}` ends up in `options.fooBar`). **[run]**
3. `SIDC` (upper case) is a backwards-compat alias for `sidc`. **[run]**
4. Every call re-runs the whole pipeline: `getMetadata()` → `getColors()` → all 9 symbol parts → bbox → anchors.
5. Returns `this`.

```js
const s = new ms.Symbol("14031000001211000000");
s.setOptions({ size: 35 }) === s;              // true  [run]
s.setOptions({ uniqueDesignation: "A" }, { higherFormation: "B" });  // merged
s.setOptions("14031500001201000000");          // replaces only the SIDC, keeps everything else
```

### 1.2 SIDC handling **[src]** `src/ms/symbol/getmetadata.js`, `src/numbersidc/metadata.js`

```js
this.options.sidc = String(this.options.sidc).replace(/\*/g, "-").replace(/ /g, "");
metadata.numberSIDC = !isNaN(this.options.sidc.substr(0, 2));
```

* Spaces are stripped, `*` is converted to `-` (legacy 2525B wildcard). **[run]**
* First two chars numeric ⇒ number-based (2525D/E, APP‑6D/E); otherwise letter-based (2525B/C, APP‑6B).
* **This normalisation happens inside `getMetadata()`**, which mutates `this.options.sidc`. Calling
  `getMetadata()` again is not free of side effects.

Number-SIDC digit map as milsymbol actually parses it **[src]**:

| 1‑based pos | `substr` | Meaning | Notes |
|---|---|---|---|
| 1–2 | `(0,2)` | Version | `10/11/12` → `metadata.edition = "D"`; `13/14` → `"E"` |
| 3 | `(2,1)` | Context | `0` Reality, `1` Exercise, `2` Simulation |
| 4 | `(3,1)` | Standard identity | `0,1`→Unknown · `2,3`→Friend · `4`→Neutral · `5,6`→Hostile |
| 5–6 | `(4,2)` | Symbol set | see §3.1 |
| 7 | `(6,1)` | Status | `0` Present · `1` Planned/Anticipated · `2` Fully Capable · `3` Damaged · `4` Destroyed · `5` Full To Capacity |
| 8 | `(7,1)` | HQ/TF/FD | bit-ish: `1,3,5,7`→feint/dummy · `2,3,6,7`→HQ · `4,5,6,7`→task force |
| 9–10 | `(8,2)` | Amplifier | `≤30` echelon · `30–69` mobility · `70–79` leadership |
| 11–16 | `(10,6)` | Entity / type / subtype | |
| 17–18 | `(16,2)` | Modifier 1 | |
| 19–20 | `(18,2)` | Modifier 2 | |
| **21** | `(20,1)` | **Modifier‑1 sector prefix** (milsymbol extension) | `_modifier1 = sidc[20] + sidc[16..17]`; `"0"` ⇒ plain 2-digit lookup |
| **22** | `(21,1)` | **Modifier‑2 sector prefix** | same for modifier 2 |
| **23** | `(22,1)` | **Frame-shape override** (2525E/APP‑6E only) | `1` Space · `2` Air · `3` Land Unit · `4` Land Equip/Sea Surf · `5` Land Instal · `6` Dismounted · `7` Sea Subsurf · `8` Activity · `9` Cyberspace · `A` unframed |

20-char SIDCs are fine — `substr` past the end yields `""` and the code defaults those to `"0"`. **[run]**

**APP‑6E version digits = `"14"`** **[ext]** (2525D `10`, APP‑6D `11`, 2525E `13`, APP‑6E `14`).
milsymbol only distinguishes edition D vs E from these, **plus one asymmetry** — see §8.2.

### 1.3 Every recognised `options` key

These 31 are declared in the constructor **[src]** `src/ms/symbol.js:12-48`, plus `sidc`. The "Renders as"
column is measured **[run]** (`research/scratch/11-amplifier-effect.mjs`) — a field only draws if the
current symbol set routes it into one of the 10 text slots L1–L5 / R1–R5.

| Option | APP‑6 Field ID | Type | Default | Where it renders (number SIDC) |
|---|---|---|---|---|
| `sidc` | — | `string` | `undefined` | the symbol itself |
| `quantity` | C | `string` | `""` | centred above frame (`x=100`, `y=bbox.y1-10`), `fontsize=infoSize`; for Dismounted (set 27) it moves **below** the frame |
| `reinforcedReduced` | F | `string` | `""` | R1 — **land units only** (`metadata.unit`); overridden by `country` when `metadata.activity` |
| `staffComments` | G | `string` | `""` | R2 (land/letter) · R5 with `additionalInformation` (Air/Space) · R4 (Sea) · R4 (Subsurface) |
| `additionalInformation` | H | `string` | `""` | R3 (land, joined with `commonIdentifier` or `equipmentTeardownTime`) · R5 (Air) · R4 (Sea) · R5 (Subsurface) |
| `evaluationRating` | J | `string` | `""` | R5 (land), joined `/` with K, L, N, P |
| `combatEffectiveness` | K | `string` | `""` | R5 (land) |
| `signatureEquipment` | L | `string` | `""` | R5 (land) |
| `higherFormation` | M | `string` | `""` | R4 (land) |
| `hostile` | N | `string` | `""` | R5 (land) |
| `iffSif` | P | `string` | `""` | R5 (land) · R2 (Air) · R3 (Sea) |
| `direction` | Q | `number` (degrees) | `undefined` | movement/speed-leader arrow, see §1.5 |
| `sigint` | R2 | `string` | `""` | **never rendered** — counted in the "do we have text?" gate but never written to any slot **[run]** |
| `uniqueDesignation` | T | `string` | `""` | L4 (land) · R1 (Air/Sea/Subsurface) |
| `type` | V | `string` | `""` | L3 (land) · R3 (Air) · R2 (Sea/Subsurface) |
| `dtg` | W | `string` | `""` | L1 (land) |
| `altitudeDepth` | X | `string` | `""` | L2 (land, joined with `location`) · R4 (Air, joined with `speed`) · R3 (Subsurface) |
| `location` | Y | `string` | `""` | L2 (land) · R5 (Sea, joined with `speed`) |
| `speed` | Z | `string` | `""` | L5 (land) · R4 (Air) · R5 (Sea) |
| `speedLeader` | — | `number` (px) | `0` | `>0` switches the direction arrow to a plain speed leader of that length |
| `specialHeadquarters` | AA | `string` | `""` | **inside** the frame, centred at `(100,103)`, bold, `text-anchor=middle`, `dominant-baseline=middle`; font-size 45 for length 1–2, 39 for length 3, 33 for length ≥ 4 (`textfields.js` `text()`) |
| `country` | AC | `string` | `""` | R1, but only for **equipment/installation** (`!metadata.unit`) or **activities**. ⚠ **Not in the "has text" gate** — setting `country` alone renders nothing **[run]** |
| `platformType` | AD | `string` | `""` | L3 (land) |
| `equipmentTeardownTime` | AE | `string` | `""` | L3 (units) / R3 (equipment & installations) |
| `commonIdentifier` | AF | `string` | `""` | R3 (units) / L3 (equipment & installations) |
| `auxiliaryEquipmentIndicator` | AG | `string` | `""` | **never rendered** — same dead-end as `sigint` **[run]** |
| `headquartersElement` | AH | `string` | `""` | centred **below** frame at `(100, bbox.y2+35)`, bold, `fontsize=35` |
| `installationComposition` | AI | `string` | `""` | L3, **equipment / installations only** |
| `engagementBar` | AO | `string` | `""` | bar 25 units tall above the symbol + bold 22 px centred text |
| `engagementType` | — | `"TARGET" \| "NON-TARGET" \| "EXPIRED"` | `""` | bar fill colour (case-insensitive); anything else → affiliation fill colour |
| `guardedUnit` | AQ | `string` | `""` | L1 (Sea only), joined with `specialDesignator` |
| `specialDesignator` | AR | `string` | `""` | L1 (Sea / Subsurface only) |

**Undeclared options that the code still reads** **[src]** `src/symbolfunctions/textfields.js`, `stack-extension.js`:

| Option | Type | Effect | Verified |
|---|---|---|---|
| `stack` | `number` | draws `n` offset copies of the frame behind the symbol (`translate(15·i, 9·i)`), widens bbox by `15·n`/`10·n` | **[run]** sizes `158×108 → 173×118 → 188×128 → 203×138` for `stack` `0/1/2/3` |
| `country_flag` | truthy | reserves **70 units** of extra right-side space for R4/R5 (hook for the closed-source flag extension) | **[run]** width `322 → 427` |
| `full_frame_flag` | truthy | with `country_flag`, cancels that reservation for Friend/Ground | **[run]** |
| `signature` | `"!"` | reserves **30 units** of extra right-side space | **[run]** width `322 → 367` |

`sigint` (R2) and `auxiliaryEquipmentIndicator` (AG) exist in `options` and in the "do we have any
text?" `||` chain, but no code path ever assigns them to a text slot. Treat them as **not implemented**.

### 1.4 Text-field slot geometry **[src]** `src/symbolfunctions/textfields.js`

All coordinates are in the 200×200 symbol space. `F = style.infoSize` (default 40),
`spaceTextIcon = 20`, `bbox` is `metadata.baseGeometry.bbox` (Ground Friend = `{25,50,175,150}`).

| Slot | x | y | `text-anchor` |
|---|---|---|---|
| L1 | `bbox.x1 - 20` | `100 − 1.5F` | `end` |
| L2 | `bbox.x1 - 20` | `100 − 0.5F` | `end` |
| L3 | `bbox.x1 - 20` | `100 + 0.5F` | `end` |
| L4 | `bbox.x1 - 20` | `100 + 1.5F` | `end` |
| L5 | `bbox.x1 - 20` | `100 + 2.5F` | `end` |
| R1 | `bbox.x2 + 20 + stack·15` | `100 − 1.5F` | `start` |
| R2 | same | `100 − 0.5F` | `start` |
| R3 | same | `100 + 0.5F` | `start` |
| R4 | `flag + bbox.x2 + 20 + stack·15` | `100 + 1.5F` | `start` |
| R5 | same | `100 + 2.5F` | `start` |

Text width is estimated from a hard-coded per-glyph table (Latin + Cyrillic) in
`src/symbolfunctions/string-width.js`; unknown glyphs fall back to **28.5** units at `fontSize=30`
(`w += (fontSize/30) * width[char]`). CJK/Arabic will be mis-measured and the bbox will be wrong. **[src]**

### 1.5 Direction arrow **[src]** `src/symbolfunctions/directionarrow.js`

* Requires `style.infoFields !== false` **and** `direction !== undefined && direction !== ""`.
* `speedLeader === 0` (default) ⇒ **movement indicator**: arrow of length 95 rotated by `direction`
  degrees about `(100,100)`, wrapped in `<g transform="rotate(deg,100,100)">`.
  For Ground (and unknown-dimension) non-HQ symbols it is additionally translated to `bbox.y2` and a
  100-unit vertical staff is drawn from `(100, bbox.y2)`. For HQ symbols it is attached to the staff tip.
* `speedLeader > 0` ⇒ a single straight line of length `speedLeader × (100 / style.size)` — i.e. the
  leader length is specified in **output pixels**, not symbol units. **[src]**

---

## 2. Every `style` option

All 29 keys are declared in `src/ms/symbol.js:50-75` **[src]**. `getStyle()` returns exactly this set.

| Option | Type | Default | Effect | Verified |
|---|---|---|---|---|
| `alternateMedal` | `boolean` | `false` | Symbol set 36 (mine warfare): `false` ⇒ `metadata.fill = false` (MEDAL rendering); `true` ⇒ alternate filled rendering | [src] `numbersidc/metadata.js` |
| `civilianColor` | `boolean` | `true` | when the symbol is civilian, Friend/Neutral/Unknown fill/frame/icon colours are replaced by the Civilian purple | [run] `rgb(128,224,255) → rgb(255,161,255)` |
| `colorMode` | `"Light" \| "Medium" \| "Dark" \| ColorMode` | `"Light"` | frame fill palette. An **object** is used verbatim | [run] |
| `fill` | `boolean` | `true` | `false` ⇒ frame is unfilled and `colors.frameColor` switches to the bright `FrameColor` palette | [run] |
| `fillColor` | `string` | `""` | overrides the frame fill with any CSS colour (**string, not ColorMode**) | [run] `fill="rgb(9,9,9)"` |
| `fillOpacity` | `number` | `1` | emitted as `fill-opacity` on the frame path/circle only | [run] |
| `fontfamily` | `string` | `"Arial"` | `font-family` on every `<text>`; sanitised against `/^[a-zA-Z0-9 ,"'_:-]+$/`, otherwise replaced by `"sans-serif"` | [run] |
| `frame` | `boolean` | `true` | `false` + `icon:true` ⇒ unframed icon; `false` + `icon:false` ⇒ position marker | [src] |
| `frameColor` | **`ColorMode` object only** | `""` | ⚠ a **string is silently ignored** (`typeof … === "object"` test) | [run] |
| `hqStaffLength` | `number` | `0` (⇒ global `ms._hqStaffLength`, default 100) | length of the HQ staff, in symbol units | [run] `208 → 308` px height |
| `icon` | `boolean` | `true` | draw the entity icon | [run] |
| `iconColor` | **`ColorMode` object only** | `""` | strings ignored, same as `frameColor` | [run] |
| `infoBackground` | `string \| ColorMode` | `""` | filled polygon behind the L and R text columns | [run] |
| `infoBackgroundFrame` | `string \| ColorMode` | `""` | **dead option** — the code reads `style.infoBackground` for the frame colour too (bug, §8.1) | [run] |
| `infoColor` | `string \| ColorMode` | `""` | colour of the amplifier text; falls back to `colors.iconColor[affiliation]` | [run] |
| `infoFields` | `boolean` | `true` | `false` suppresses **all** amplifier text **and the direction arrow** | [src] |
| `infoOutlineColor` | `string` | `"rgb(239, 239, 239)"` | outline colour for text halos | [src] |
| `infoOutlineWidth` | `number \| false` | `false` | `false` ⇒ inherit `outlineWidth`; a number (incl. `0`) overrides it | [run] |
| `infoSize` | `number` | `40` | amplifier `font-size` in symbol units | [run] |
| `monoColor` | `string` | `""` | non-empty ⇒ `metadata.fill = false`, all frame colours become this colour, fills become `none` | [run] |
| `outlineColor` | `string \| ColorMode` | `"rgb(239, 239, 239)"` | halo colour | [run] |
| `outlineWidth` | `number` | `0` | `>0` prepends a stroked duplicate of **every** drawn element (see §7.4) | [run] |
| `padding` | `number` | `0` | extra units added to all four bbox sides | [run] `158×108 → 198×148` at `padding:20` |
| `simpleStatusModifier` | `boolean` | `false` | `true` forces the slash/cross status glyph instead of the coloured condition bar | [run] |
| `size` | `number` | `100` | output scale: `width = baseWidth × size/100`. **`size < 10` forces frame `stroke-width` to 10** | [run] |
| `square` | `boolean` | `false` | pads the bbox to a square centred on the anchor — with long amplifier text this explodes (`958×958` observed) | [run] |
| `standard` | `"" \| "APP6" \| "2525"` | `""` | per-symbol override of `ms.setStandard`. `""` ⇒ use the global. **Any other value (e.g. `"APP6E"`) is treated as 2525** | [run] |
| `strokeWidth` | `number` | `4` | frame stroke width; also the base for outline width maths | [run] |
| `styleFill` | `boolean` | `false` | `true` repaints icon parts flagged `styleFill` with `rgba(255,255,255,0.4)` (echelon dots, some ground icons) | [run] |

### 2.1 Global (module-level) API on `ms` **[src] [run]**

```js
ms.getVersion()                        // "3.0.4"
ms.setStandard("APP6")                 // true   -> ms._STD2525 = false
ms.setStandard("2525")                 // true   -> ms._STD2525 = true
ms.setStandard("app6")                 // false  -> NO-OP, state unchanged (case-sensitive!)
ms.setStandard("APP6E")                // false  -> NO-OP

ms.getColorMode("Light")               // clone of the named palette
ms.setColorMode("Light", ms.ColorMode(civ, friend, hostile, neutral, unknown, suspect))
ms.ColorMode(civ, friend, hostile, neutral, unknown, suspect)  // plain object factory

ms.getDashArrays()                     // { pending:"4,4", anticipated:"8,12", feintDummy:"8,8" }
ms.setDashArrays(pending, anticipated, feintDummy)

ms.getHqStaffLength()                  // 100
ms.setHqStaffLength(250)

ms.getSymbolParts()                    // [stack, basegeometry, icon, modifier, statusmodifier,
                                       //  engagement, affliationdimension, textfieldsMod, directionarrow]
ms.setSymbolParts(arr)
ms.addSymbolPart(fn)                   // fn.call(symbol, ms) -> {pre:[], post:[], bbox:{}}
ms.showOctagon()                       // permanently adds the debug octagon part
ms.addIcons(pack)                      // clears _iconCache, registers metadata/icons/iconParts/labels
ms.addIconParts(fns) / ms.addSIDCicons(fn, "number"|"letter") / ms.addLabelOverrides(fn, type)

ms.reset()                             // full factory reset: palettes, dash arrays, hqStaffLength,
                                       // symbol parts, icon caches, _STD2525 = true, AND it empties
                                       // _getIcons / _getMetadata / _iconSIDC / _iconParts  [src]

ms.BBox({x1,y1,x2,y2})                 // bbox helper with width()/height()/merge()
ms.outline(geom, outlineWidth, strokeWidth, color)
ms.Path2D                              // Path2D polyfill for canvas on old engines
ms.setBrokenPath2D(bool)
ms._scale(factor, instr, nonScalingStroke) / ms._translate(x, y, instr)
```

⚠ **Never call `ms.reset()` in the plugin.** It empties `_getIcons` / `_getMetadata` / `_iconSIDC` /
`_iconParts`, and the very next `new ms.Symbol(...)` **throws** **[run]**:

```
TypeError: Cannot read properties of undefined (reading '')
    at Symbol.icon (src/symbolfunctions/icon.js:252)
```

Recovery requires re-running `ms.addIcons(std2525e)` (and friends) **and** `ms.setStandard("APP6")`,
because `reset()` also restores `_STD2525 = true`. **[src]** `src/ms.js:64-95`

⚠ Global state (`setStandard`, `setColorMode`, `setDashArrays`, `setHqStaffLength`) is **process-wide**.
In the plugin, prefer the per-symbol `style.standard` / `style.hqStaffLength` / `style.colorMode`
overrides so nothing leaks between renders.

---

## 3. `setStandard("APP6")` vs `setStandard("2525")` — measured diff

### 3.1 Method

`research/scratch/03-std-diff.mjs` and `04-std-diff-detail.mjs` enumerate **every** entity code in the
`milstandard-e` TSV catalogue (1 721 entities across all 20 symbol sets), cross them with **all 7
standard identities** (`0`–`6`) and compare `asSVG()` under `{standard:"2525"}` vs `{standard:"APP6"}`.

```
TOTAL renders compared: 12 047   differing: 1 064   distinct entities differing: 152
```

Additional sweeps (`05-std-diff-amplifiers.mjs`) covered, per symbol set, all 100 modifier‑1 values,
all 100 modifier‑2 values, all 100 amplifier/echelon values, all statuses, all HQ/TF/FD values,
all contexts and all version digits.

### 3.2 What does **not** differ between APP‑6 and 2525 **[run]**

* **Frames** — every frame shape, every affiliation, every dimension is byte-identical.
* **Echelon / mobility / leadership amplifiers** (digits 9–10): 0 differences across all 100 values × 13 symbol sets.
* **Status** (digit 7): condition bars, dashes, slash/cross — identical.
* **HQ / task force / feint-dummy** (digit 8): identical.
* **Context** (digit 3): the `X` / `S` / `J` / `K` exercise letters — identical.
* **Colours** — `getColors()` is completely independent of the standard.
* **Text amplifier layout** — identical.

The switch is therefore **purely an icon-glyph switch**. `setStandard` is verified **[run]** to be
exactly equivalent to `{standard:"APP6"}` on every symbol.

### 3.3 Where they differ

**(a) Modifier glyphs** (each row = the modifier codes whose glyph changes, with a fixed entity):

| Symbol set | Modifier 1 codes that differ | Modifier 2 codes that differ |
|---|---|---|
| `10` Land unit | `01, 47, 56, 58, 71, 72, 73, 74` | — |
| `27` Dismounted individual | `27`–`40` (rank labels: 2525 `O-8` vs APP‑6 `OF-7` …) | `14`–`23`, `25`–`33` (rank labels) |
| `40` Activities | `04` | — |
| `01` Air | `24` | — |

Example **[run]**: `13002700001100002700` → 2525 draws `O-8` at `font-size 25`; APP‑6 draws `OF-7` at
`font-size 22`. US pay-grade vs NATO OF-code — a *real* APP‑6 requirement, so the plugin must set APP6.

**(b) Icon fill convention.** Many 2525 icons are filled `rgb(239,239,239)` (OffWhite) where the same
APP‑6 icon is `fill="none"`. Source pattern **[src]** (`src/iconparts/*.js`):
`fill: STD2525 || numberSIDC ? iconFillColor : !frame ? iconFillColor : false`.
Observed **[run]** on `13002000001120000000` (Warehouse/Storage):
`fill="rgb(239, 239, 239)"` (2525) vs `fill="none"` (APP‑6).

**(c) Icon lettering.** `AR.I.VSTOL` → 2525 `"L"` / APP‑6 `"V"`; `ELECTRONIC SUPPORT MEASURES` →
`"Z"` / `"ESM"`; `MINE WARFARE` → `"MIW"` / `"MW"`; `SERVICE CRAFT, YARD` → `"YY"` / `"YT"`;
`AUXILIARY SHIP` → `"AR"` / `"AA"`. **[src]** `src/iconparts/air.js`, `sea.js`, `common-modifiers.js`

**(d) Whole-glyph substitutions.** Example `13000100001101000000` (Air / Military / Fixed Wing):
2525 emits a 320-char detailed aircraft path; APP‑6 emits
`M100,100 L130,88 c15,0 15,24 0,24 L100,100 70,112 c-15,0 -15,-24 0,-24 Z`. **[run]**

### 3.4 The complete list of 152 entities whose icon differs

Every one of these differs for **all 7 standard identities** (affiliation-independent).
Generated by `research/scratch/04-std-diff-detail.mjs`; names from the `milstandard-e` TSV tables.

| Set | Entity code | Name |
|---|---|---|
| `01` | `110100` | Military / Fixed Wing |
| `01` | `110121` | Military / Fixed Wing / Electronic Support (ES) |
| `01` | `120100` | Civilian / Fixed Wing |
| `05` | `120100` | Civilian / Orbiter Shuttle |
| `05` | `120200` | Civilian / Capsule |
| `05` | `120300` | Civilian / Satellite |
| `05` | `120400` | Civilian / Astronomical Satellite |
| `05` | `120500` | Civilian / Biosatellite |
| `05` | `120600` | Civilian / Communications Satellite |
| `05` | `120700` | Civilian / Earth Observation Satellite |
| `05` | `120800` | Civilian / Miniaturized Satellite |
| `05` | `120900` | Civilian / Navigational Satellite |
| `05` | `121000` | Civilian / Space Station |
| `05` | `121100` | Civilian / Tethered Satellite |
| `05` | `121200` | Civilian / Weather Satellite |
| `10` | `121801` | Movement and Maneuver / Special Operations Forces (SOF) / Fixed Wing MISO |
| `10` | `130900` | Fires / Survey |
| `10` | `150400` | Intelligence / Electronic Ranging |
| `10` | `190000` | Emergency Operation |
| `10` | `200200` | Law Enforcement / Border Patrol |
| `10` | `200300` | Law Enforcement / Customs Service |
| `10` | `201100` | Law Enforcement / Coast Guard |
| `15` | `160100` | Civilian Vehicle / Automobile |
| `15` | `160200` | Civilian Vehicle / Open-Bed Truck |
| `15` | `160300` | Civilian Vehicle / Multiple Passenger Vehicle |
| `15` | `160400` | Civilian Vehicle / Utility Vehicle |
| `15` | `160500` | Civilian Vehicle / Jeep Type Vehicle |
| `15` | `160600` | Civilian Vehicle / Tractor Trailer Truck with Box |
| `15` | `160700` | Civilian Vehicle / Tractor Trailer Truck with Flatbed Trailer |
| `15` | `170200` | Law Enforcement / Border Patrol |
| `15` | `170300` | Law Enforcement / Customs Service |
| `15` | `171000` | Law Enforcement / Coast Guard |
| `15` | `201100` | Other Equipment / Military Information Support Operations (MISO) |
| `15` | `230000` | Emergency Operation |
| `15` | `230100` | Emergency Operation / {Disused} |
| `20` | `112000` | Military/Civilian / Warehouse/Storage Facility |
| `20` | `112102` | Military/Civilian / Law Enforcement / Border Patrol |
| `20` | `112103` | Military/Civilian / Law Enforcement / Customs Service |
| `20` | `112111` | Military/Civilian / Law Enforcement / Coast Guard |
| `20` | `112200` | Military/Civilian / Emergency Operation |
| `20` | `120100` | Infrastructure / Agriculture and Food |
| `20` | `120101` | Infrastructure / Agriculture and Food / Agriculture Laboratory |
| `20` | `120102` | Infrastructure / Agriculture and Food / Animal Feedlot |
| `20` | `120104` | Infrastructure / Agriculture and Food / Farm/Ranch |
| `20` | `120108` | Infrastructure / Agriculture and Food / Grain Storage |
| `20` | `120201` | Infrastructure / Banking Finance and Insurance / ATM |
| `20` | `120202` | Infrastructure / Banking Finance and Insurance / Bank |
| `20` | `120203` | Infrastructure / Banking Finance and Insurance / Bullion Storage |
| `20` | `120205` | Infrastructure / Banking Finance and Insurance / Federal Reserve Bank |
| `20` | `120300` | Infrastructure / Commercial |
| `20` | `120301` | Infrastructure / Commercial / Chemical Plant |
| `20` | `120302` | Infrastructure / Commercial / Firearms Manufacturer |
| `20` | `120303` | Infrastructure / Commercial / Firearms Retailer |
| `20` | `120304` | Infrastructure / Commercial / Hazardous Material Production |
| `20` | `120305` | Infrastructure / Commercial / Hazardous Material Storage |
| `20` | `120306` | Infrastructure / Commercial / Industrial Site |
| `20` | `120307` | Infrastructure / Commercial / Landfill |
| `20` | `120308` | Infrastructure / Commercial / Pharmaceutical Manufacturer |
| `20` | `120309` | Infrastructure / Commercial / Contaminated Hazardous Waste Site |
| `20` | `120310` | Infrastructure / Commercial / Toxic Release Inventory |
| `20` | `120506` | Infrastructure / Energy Facility / Propane Facility |
| `20` | `120600` | Infrastructure / Government Site |
| `20` | `120800` | Infrastructure / Military |
| `20` | `120900` | Infrastructure / Postal Services |
| `20` | `120901` | Infrastructure / Postal Services / Postal Distribution Center |
| `20` | `120902` | Infrastructure / Postal Services / Post Office |
| `20` | `121001` | Infrastructure / Public Venues / Enclosed Facility (Public Venue) |
| `20` | `121004` | Infrastructure / Public Venues / Religious Institution |
| `20` | `121102` | Infrastructure / Special Needs / Child Day Care |
| `20` | `121303` | Infrastructure / Transportation / Bus Station |
| `20` | `121304` | Infrastructure / Transportation / Ferry Terminal |
| `20` | `121305` | Infrastructure / Transportation / Helicopter Landing Site |
| `20` | `121311` | Infrastructure / Transportation / Toll Facility |
| `20` | `121312` | Infrastructure / Transportation / Traffic Inspection Facility |
| `20` | `121313` | Infrastructure / Transportation / Tunnel |
| `20` | `121405` | Infrastructure / Water Supply / Pumping Station |
| `20` | `121406` | Infrastructure / Water Supply / Reservoir |
| `20` | `121407` | Infrastructure / Water Supply / Storage Tower |
| `20` | `121408` | Infrastructure / Water Supply / Surface Water Intake |
| `20` | `121409` | Infrastructure / Water Supply / Wastewater Treatment Facility |
| `25` | `180900` | Airspace Control Points / ASW (Helo and F/W) Station |
| `25` | `181400` | Airspace Control Points / Surface Combat Air Patrol (SUCAP) – Fixed Wing |
| `25` | `181600` | Airspace Control Points / MIW – Fixed Wing |
| `25` | `181700` | Airspace Control Points / MIW – Rotary Wing |
| `30` | `120801` | Military Combatant / Speedboat / Rigid–Hull Inflatable Boat (RHIB) |
| `30` | `130200` | Military Non Combatant / Service Craft/Yard |
| `30` | `140100` | Civilian / Merchant Ship |
| `30` | `140101` | Civilian / Merchant Ship / Cargo, General |
| `30` | `140102` | Civilian / Merchant Ship / Container Ship |
| `30` | `140103` | Civilian / Merchant Ship / Dredge |
| `30` | `140104` | Civilian / Merchant Ship / Roll On/Roll Off |
| `30` | `140105` | Civilian / Merchant Ship / Ferry |
| `30` | `140106` | Civilian / Merchant Ship / Heavy Lift |
| `30` | `140107` | Civilian / Merchant Ship / Hovercraft |
| `30` | `140108` | Civilian / Merchant Ship / Lash Carrier (with Barges) |
| `30` | `140109` | Civilian / Merchant Ship / Oiler/Tanker |
| `30` | `140110` | Civilian / Merchant Ship / Passenger |
| `30` | `140111` | Civilian / Merchant Ship / Tug, Ocean Going |
| `30` | `140112` | Civilian / Merchant Ship / Tow |
| `30` | `140113` | Civilian / Merchant Ship / Transport Ship, Hazardous Material |
| `30` | `140114` | Civilian / Merchant Ship / Junk/Dhow |
| `30` | `140115` | Civilian / Merchant Ship / Barge, not Self–Propelled |
| `30` | `140116` | Civilian / Merchant Ship / Hospital Ship |
| `30` | `140200` | Civilian / Fishing Vessel |
| `30` | `140201` | Civilian / Fishing Vessel / Drifter |
| `30` | `140202` | Civilian / Fishing Vessel / Trawler |
| `30` | `140203` | Civilian / Fishing Vessel / Dredger |
| `30` | `140300` | Civilian / Law Enforcement Vessel |
| `30` | `140400` | Civilian / Leisure Craft, Sailing |
| `30` | `140500` | Civilian / Leisure Craft, Motorized |
| `30` | `140501` | Civilian / Leisure Craft, Motorized / Rigid–Hull Inflatable Boat (RHIB) |
| `30` | `140502` | Civilian / Leisure Craft, Motorized / Speedboat |
| `30` | `140600` | Civilian / Jet Ski |
| `35` | `120100` | Civilian / Submersible |
| `35` | `120200` | Civilian / Autonomous Underwater Vehicle (AUV)/ Unmanned Underwater Vehicle (UUV) |
| `40` | `110100` | Incident / Criminal Activity Incident |
| `40` | `110102` | Incident / Criminal Activity Incident / Arson |
| `40` | `110112` | Incident / Criminal Activity Incident / {Disused} |
| `40` | `110123` | Incident / Criminal Activity Incident / Suspicious Activity |
| `40` | `130200` | Operation / Military Information Support Operation (MISO) |
| `40` | `130201` | Operation / Military Information Support Operation (MISO) / TV and Radio Propaganda |
| `40` | `131100` | Operation / Raid on House |
| `40` | `131200` | Operation / Emergency Operation |
| `40` | `131201` | Operation / Emergency Operation / Emergency Collection Evacuation Point |
| `40` | `131203` | Operation / Emergency Operation / Emergency Incident Command Center |
| `40` | `131204` | Operation / Emergency Operation / Emergency Operations Center |
| `40` | `131205` | Operation / Emergency Operation / Emergency Public Information Center |
| `40` | `131206` | Operation / Emergency Operation / Emergency Shelter |
| `40` | `131207` | Operation / Emergency Operation / Emergency Staging Area |
| `40` | `131301` | Operation / Emergency Medical Operation / EMT Station Location |
| `40` | `131303` | Operation / Emergency Medical Operation / Medical Facilities Outpatient |
| `40` | `131304` | Operation / Emergency Medical Operation / Morgue |
| `40` | `131306` | Operation / Emergency Medical Operation / Triage |
| `40` | `131401` | Operation / Fire Fighting Operation / Fire Hydrant |
| `40` | `131403` | Operation / Fire Fighting Operation / Other Water Supply Location |
| `40` | `131502` | Operation / Law Enforcement Operation / Border Patrol |
| `40` | `131503` | Operation / Law Enforcement Operation / Customs Service |
| `40` | `131511` | Operation / Law Enforcement Operation / Coast Guard |
| `40` | `140100` | Fire Event / Fire Origin |
| `40` | `140300` | Fire Event / Hot Spot |
| `40` | `150100` | Hazardous Materials / Hazardous Materials Incident |
| `40` | `150103` | Hazardous Materials / Hazardous Materials Incident / Hazardous when Wet |
| `40` | `150104` | Hazardous Materials / Hazardous Materials Incident / Explosive Material |
| `40` | `150105` | Hazardous Materials / Hazardous Materials Incident / Flammable Gas |
| `40` | `150106` | Hazardous Materials / Hazardous Materials Incident / Flammable Liquid |
| `40` | `150107` | Hazardous Materials / Hazardous Materials Incident / Flammable Solid |
| `40` | `150108` | Hazardous Materials / Hazardous Materials Incident / Non-Flammable Gas |
| `40` | `150109` | Hazardous Materials / Hazardous Materials Incident / Organic Peroxide |
| `40` | `150110` | Hazardous Materials / Hazardous Materials Incident / Oxidizer |
| `40` | `150113` | Hazardous Materials / Hazardous Materials Incident / Toxic Gas |
| `40` | `160100` | Transportation Incident / Air |
| `40` | `160200` | Transportation Incident / Marine |

### 3.5 Edition D vs edition E (version `10/11/12` vs `13/14`)

Only **18 entities, all in symbol set 60 (Cyberspace)**, render differently between edition D and E
(APP‑6, SI = Friend, 1 721 entities compared) **[run]**:

`60/110100` Combat Mission Team · `60/110200` National Mission Team · `60/110300` Cyber Protection Team ·
`60/110400` {Disused} · `60/120000` Threat Actors · `60/120200` Insider · `60/130100` Firewall ·
`60/130200` Firmware · `60/140000` Application · `60/140300` Search Engine · `60/140400` Social Media ·
`60/150100` Malware · `60/150200` Phishing · `60/150300` Spear Phishing · `60/150400` Whale Phishing ·
`60/160000` Data · `60/160100` Digital Currency · `60/160200` Persona

The `if (!_STD2525 /*This is APP6*/ && edition == "E") { /* APP6E overrides */ }` block in
`src/numbersidc/sidc/cyberspace.js:157` is **empty** — the hook exists but no APP‑6E-specific
cyberspace overrides are implemented yet. **[src]**

⚠ This count is the **cold-cache** number. With a warm icon cache the same sweep reports **19**,
because `15/130100` (Land equipment) starts differing once `15/130200` has been rendered. That is the
order-dependency bug documented as **bug #17** in §8.1 — it is not a real D/E difference.

### 3.6 Version `13` vs `14` — the only difference is Suspect

Comparing all 1 721 entities × 7 standard identities × filled/unfilled (24 094 renders) between
version `13` (2525E) and version `14` (APP‑6E) **[run]**: **2 549 differ, and every single one has
standard identity `5`**. See §8.2 — this is a bug, not a standards difference.

---

## 4. Colours

### 4.1 Where the palettes live **[src]** `src/colormodes.js`

Nine named palettes are registered by `ms.reset()`. Each is a `ColorMode`
`{ Civilian, Friend, Hostile, Neutral, Unknown, Suspect }`. `ms.getColorMode(name)` returns a **clone**,
so mutating the result is safe. **[src]** `src/ms.js` `getColorMode`.

Dumped live with `ms.getColorMode(...)` **[run]** (`research/scratch/10-dumps.mjs`):

| Palette | Civilian | Friend | Hostile | Neutral | Unknown | Suspect |
|---|---|---|---|---|---|---|
| **Light** (default `colorMode`) | `rgb(255,161,255)` `#FFA1FF` | `rgb(128,224,255)` `#80E0FF` | `rgb(255,128,128)` `#FF8080` | `rgb(170,255,170)` `#AAFFAA` | `rgb(255,255,128)` `#FFFF80` | `rgb(255, 229, 153)` `#FFE599` |
| **Medium** | `rgb(128,0,128)` `#800080` | `rgb(0,168,220)` `#00A8DC` | `rgb(255,48,49)` `#FF3031` | `rgb(0,226,110)` `#00E26E` | `rgb(255,255,0)` `#FFFF00` | `rgb(255, 217, 107)` `#FFD96B` |
| **Dark** | `rgb(80,0,80)` `#500050` | `rgb(0,107,140)` `#006B8C` | `rgb(200,0,0)` `#C80000` | `rgb(0,160,0)` `#00A000` | `rgb(225,220,0)` `#E1DC00` | `rgb(255, 188, 1)` `#FFBC01` |
| **FrameColor** (used when `fill:false`) | `rgb(255,0,255)` `#FF00FF` | `rgb(0, 255, 255)` `#00FFFF` | `rgb(255, 0, 0)` `#FF0000` | `rgb(0, 255, 0)` `#00FF00` | `rgb(255, 255, 0)` `#FFFF00` | ⚠ **`rbg(255, 188, 1)`** — typo, invalid CSS |
| **IconColor** | `rgb(255,0,255)` `#FF00FF` | `rgb(0, 255, 255)` `#00FFFF` | `rgb(255, 0, 0)` `#FF0000` | `rgb(0, 255, 0)` `#00FF00` | `rgb(255, 255, 0)` `#FFFF00` | `rgb(255, 188, 1)` `#FFBC01` |
| **Black** | `black` | `black` | `black` | `black` | `black` | `black` |
| **White** | `white` | `white` | `white` | `white` | `white` | `white` |
| **OffWhite** (icon fill in filled symbols) | `rgb(239, 239, 239)` `#EFEFEF` | idem | idem | idem | idem | idem |
| **None** | `false` | `false` | `false` | `false` | `false` | `false` |

`false` is serialised by `asSVG()` as the literal string `"none"`. **[src]** `assvg.js` — `attr("fill", fill ? sanitizeColor(fill,"none") : "none")`

### 4.2 Hard-coded colours not in any palette **[src]**

| Colour | Hex | Where |
|---|---|---|
| `rgb(0,255,0)` | `#00FF00` | condition bar, status `2` Fully Capable — `symbolfunctions/statusmodifier.js:16` |
| `rgb(255,255,0)` | `#FFFF00` | condition bar, status `3` Damaged |
| `rgb(255,0,0)` | `#FF0000` | condition bar, status `4` Destroyed |
| `rgb(0, 180, 240)` | `#00B4F0` | condition bar, status `5` Full To Capacity |
| `rgb(255, 0, 0)` | `#FF0000` | engagement bar `engagementType:"TARGET"` — `engagmentbar.js:37` |
| `rgb(255, 255, 255)` | `#FFFFFF` | engagement bar `"NON-TARGET"` |
| `rgb(255, 120, 0)` | `#FF7800` | engagement bar `"EXPIRED"` |
| `rgb(0, 130, 24)` | `#008218` | MEDAL mine icons — `iconparts/subsurface.js` |
| `rgb(255,141,42)` | `#FF8D2A` | MEDAL mine icons |
| `rgba(255,255,255,0.4)` | — | `style.styleFill:true` repaint |
| `rgb(0,0,255)` | `#0000FF` | debug octagon (`ms.showOctagon()`) |

All of the above were observed in the 1.44 M-symbol attribute sweep **[run]** (§7.2).

### 4.3 `getColors()` resolution order **[src]** `src/ms/symbol/getcolors.js`

```
baseFillColor  = typeof style.colorMode  === "object" ? style.colorMode  : ms.getColorMode(style.colorMode)
baseFrameColor = typeof style.frameColor === "object" ? style.frameColor : ms.getColorMode("FrameColor")
baseIconColor  = typeof style.iconColor  === "object" ? style.iconColor  : ms.getColorMode("IconColor")
```
then, in order:
1. `style.civilianColor && metadata.civilian` → Friend = Neutral = Unknown = Civilian for fill/frame/icon
2. `metadata.joker || metadata.faker` → Friend = Hostile
3. `metadata.suspect` → Friend = Hostile = Suspect
4. `style.monoColor !== ""` → all frame colours = `monoColor`; `black` ← frameColor; `white` and `fillColor` ← `None`
5. if `metadata.fill` (filled symbol): `fillColor` = palette, `frameColor` = **Black**, `iconColor` = **Black**, `iconFillColor` = **OffWhite**, `white` = OffWhite
6. if not filled: `fillColor` = None, `frameColor` = FrameColor palette, `iconColor` = FrameColor palette, `iconFillColor` = None

Note steps 1–3 **mutate the objects returned by `ms.getColorMode`**; that is safe only because
`getColorMode` clones. If you pass your own `colorMode` **object**, milsymbol will mutate *your*
object for civilian/joker/suspect symbols. **Always pass a fresh object per render.** **[src]**

---

## 5. Output / measurement API

Instance own-properties after construction **[run]**:
`bbox, colors, metadata, octagonAnchor, options, style, symbolAnchor, validIcon, drawInstructions,
baseWidth, baseHeight, width, height` (+ `XML` after the first `asSVG()`).

### 5.1 `asSVG(): string` — pure string building

**Signature:** `asSVG(): string`. Caches the result on `this.XML` and returns it (it **recomputes
every call**, it does not read the cache). **[src]** `src/ms/symbol/assvg.js`

Root element (exact, attribute order is fixed) **[run]**:

```
<svg xmlns="http://www.w3.org/2000/svg" version="1.2" baseProfile="tiny"
     width="{width}" height="{height}" viewBox="{vx} {vy} {baseWidth} {baseHeight}">
```

with **[src]**:

```
vx        = bbox.x1 - strokeWidth - outlineWidth
vy        = bbox.y1 - strokeWidth - outlineWidth
baseWidth = bbox.width()  + 2*strokeWidth + 2*outlineWidth
baseHeight= bbox.height() + 2*strokeWidth + 2*outlineWidth
width     = baseWidth  * style.size / 100
height    = baseHeight * style.size / 100
```

**viewBox semantics:** the user space is the milsymbol 200×200 symbol space (the octagon is centred on
`(100,100)`; a Ground Friend frame is `x 25..175, y 50..150`). `width`/`height` are unitless
(= CSS px). `style.size` is therefore a pure uniform scale — **the geometry never changes with `size`**,
only the root `width`/`height`. Exception: `size < 10` bumps frame `stroke-width` from 4 to 10. **[run]**

Example root **[run]** — `new ms.Symbol("14031000141211000000",{size:35})`:
```
<svg xmlns="http://www.w3.org/2000/svg" version="1.2" baseProfile="tiny"
     width="55.3" height="47.425" viewBox="21 18.5 158 135.5">
```

*Gotchas:* `viewBox` can have **negative** origin (common once amplifier text is present, e.g.
`viewBox="-563.666… -27 1286 287"`), and `width`/`height` are frequently **non-integer floats with
17 significant digits** (`184.5666666666667`). Round them yourself if Figma or your layout needs
integers.

### 5.2 `asDOM(): Element` — **requires DOM** **[src] [run]**

```js
Symbol.prototype.asDOM = function () {
  const doc = document;
  const doc2 = new DOMParser().parseFromString(this.asSVG(), "text/xml");
  return doc.adoptNode(doc2.documentElement);
};
```
Needs `document` **and** `DOMParser`. In plain Node: `ReferenceError: document is not defined`. **[run]**
Works in the Figma **UI iframe**; **not** available in the Figma plugin sandbox (`figma.*` main thread).

### 5.3 `asCanvas(ratio = 1): HTMLCanvasElement` — **requires DOM** **[src] [run]**

Calls `document.createElement("canvas")`, sets `canvas.width = this.width * ratio`, then `canvasDraw`.
Also probes `Path2D` support once and caches the answer in `ms._brokenPath2D`.
Plain Node: `ReferenceError: document is not defined`. **[run]**

### 5.4 `asOffscreenCanvas(ratio = 1): OffscreenCanvas` — **requires `OffscreenCanvas`** **[run]**
Plain Node: `ReferenceError: OffscreenCanvas is not defined`.

### 5.5 `toDataURL(): string` — pure **[src] [run]**
`"data:image/svg+xml;utf8," + encodeURIComponent(this.asSVG())`. No DOM. Note: **not** base64.

### 5.6 `getSize(): {width, height}` **[src] [run]**

Returns **output pixels** (already multiplied by `size/100`), not symbol units.
```js
new ms.Symbol("14031000141211000000",{size:35}).getSize()  // { width: 55.3, height: 47.425 }
```
⚠ **Bug:** if `width`/`height` are undefined it calls `this.updateSymbol()`, which **does not exist**.
`new ms.Symbol().getSize()` throws `TypeError: this.updateSymbol is not a function`. **[run]**
Never construct a `Symbol` with no arguments.

### 5.7 `getAnchor(): {x, y}` and `getOctagonAnchor(): {x, y}` **[src] [run]**

Both are in **output pixels**, measured from the **top-left of the SVG**:
```
x = (anchor.x - bbox.x1 + strokeWidth + outlineWidth) * size / 100
y = (anchor.y - bbox.y1 + strokeWidth + outlineWidth) * size / 100
```
* `getOctagonAnchor()` always uses `anchor = {x:100, y:100}` — the **centre of the symbol octagon**.
* `getAnchor()` uses the same point **except for headquarters symbols**, where
  `anchor = { x: baseGeometry.bbox.x1, y: baseGeometry.bbox.y2 + hqStaffLength }`, i.e. the **tip of
  the HQ staff** — the true map position.

Verified **[run]** on `14031002001211000000` (Land unit, HQ):
`getSize() = {158, 208}` · `getAnchor() = {x:4, y:204}` · `getOctagonAnchor() = {x:79, y:54}`.
With `hqStaffLength:200`: `getSize() = {158, 308}` · `getAnchor() = {x:4, y:304}`.

To place a symbol at map/canvas point `(px, py)`: `left = px - anchor.x`, `top = py - anchor.y`.

### 5.8 `getColors(): SymbolColors` **[src] [run]**

Returns `{ fillColor, frameColor, iconColor, iconFillColor, none, black, white }`, each a full
`ColorMode`. **Recomputed on every call** (does not return `this.colors`). Real dump for
`new ms.Symbol("14031000141211000000", {size:35, …})`:

```json
{
 "fillColor":     {"Civilian":"rgb(255,161,255)","Friend":"rgb(128,224,255)","Hostile":"rgb(255,128,128)",
                   "Neutral":"rgb(170,255,170)","Unknown":"rgb(255,255,128)","Suspect":"rgb(255, 229, 153)"},
 "frameColor":    {"Civilian":"black","Friend":"black","Hostile":"black","Neutral":"black","Unknown":"black","Suspect":"black"},
 "iconColor":     {"Civilian":"black","Friend":"black","Hostile":"black","Neutral":"black","Unknown":"black","Suspect":"black"},
 "iconFillColor": {"Civilian":"rgb(239, 239, 239)","Friend":"rgb(239, 239, 239)","Hostile":"rgb(239, 239, 239)",
                   "Neutral":"rgb(239, 239, 239)","Unknown":"rgb(239, 239, 239)","Suspect":"rgb(239, 239, 239)"},
 "none":          {"Civilian":false,"Friend":false,"Hostile":false,"Neutral":false,"Unknown":false,"Suspect":false},
 "black":         {"Civilian":"black", …},
 "white":         {"Civilian":"rgb(239, 239, 239)", …}
}
```
Pick the active colour with `colors.fillColor[sym.getMetadata().affiliation]`.

### 5.9 `getMetadata(): SymbolMetadata` **[src] [run]**

There is **no `getProperties()`** — the method is `getMetadata()`. It **recomputes** metadata from
`this.options.sidc` and **mutates `this.options.sidc`** (strips spaces, `*`→`-`). Real dump for
`14031000141211000000` (APP‑6E, Friend, Land unit, Platoon, Infantry):

```json
{
 "activity": false, "affiliation": "Friend", "baseAffilation": "Friend", "baseDimension": "Ground",
 "baseGeometry": { "g": { "type": "path", "d": "M25,50 l150,0 0,100 -150,0 z" },
                   "bbox": { "x1": 25, "y1": 50, "x2": 175, "y2": 150 } },
 "civilian": false, "condition": "", "context": "Reality", "dimension": "Ground",
 "dimensionUnknown": false, "echelon": "Platoon/detachment", "faker": false, "fenintDummy": false,
 "fill": true, "frame": true, "functionid": "1211000000", "headquarters": false,
 "installation": false, "joker": false, "mobility": "", "notpresent": "", "numberSIDC": true,
 "space": false, "STD2525": true, "taskForce": false, "unit": true,
 "edition": "E", "_modifier1": "000", "_modifier2": "000"
}
```

Notes: `fenintDummy` is a **typo for feintDummy** and is never set — the real flag written by
`numbersidc/metadata.js` is `metadata.feintDummy`. `functionid` is `sidc.substr(10,10)` (entity + both
modifiers), **not** just the 6-digit entity. Undeclared extras appear too:
`edition`, `_modifier1`, `_modifier2`, `dismounted`, `landequipment`, `controlMeasure`, `cyberspace`,
`suspect`, `leadership`.

### 5.10 `getOptions(includeStyle = true)` and `getStyle()` **[src] [run]**

`getOptions()` with no argument (or `undefined`) **includes the style keys** — 32 option keys + 29
style keys flattened into one object. `getOptions(false)` returns only the 31 amplifier options +
`sidc`. `getStyle()` returns only the 29 style keys. All are shallow clones. Full dumps:
`research/scratch/10-dumps.mjs`.

### 5.11 `setOptions(...)` — see §1.1. Returns `this`.

### 5.12 `isValid(extended = false)` **[src] [run]**

```js
isValid()      // boolean
isValid(true)  // { affiliation, dimension, dimensionUnknown, drawInstructions, icon, mobility }
```
```js
return !(metadata.affiliation == "undefined" ||
         (metadata.dimension == "undefined" && !metadata.controlMeasure))
       && JSON.stringify(this.drawInstructions).indexOf("null") == -1
       && this.validIcon
       && this.metadata.mobility != undefined;
```

**This is the single most important guard in the plugin.** An unknown entity code does **not** throw
and does **not** produce an empty SVG — `icon.js` pushes an `undefinedIcon` (a question-mark glyph,
path starting `m 94.8206,78.1372 …`) and sets `this.validIcon = false`. **[src] [run]**

Coverage sweep over every entity in the `milstandard-e` catalogue, APP‑6E, SI = Friend **[run]**
(`research/scratch/15-validity.mjs`): **0 throws** anywhere; invalid only in symbol set 25:

| Symbol set | valid | invalid | threw |
|---|---|---|---|
| 01 Air | 53 | 0 | 0 |
| 02 Air missile | 1 | 0 | 0 |
| 05 Space | 36 | 0 | 0 |
| 06 Space missile | 1 | 0 | 0 |
| 10 Land unit | 214 | 0 | 0 |
| 11 Land civilian | 11 | 0 | 0 |
| 15 Land equipment | 206 | 0 | 0 |
| 20 Land installation | 131 | 0 | 0 |
| **25 Control measures** | **264** | **364** | 0 |
| 27 Dismounted individual | 45 | 0 | 0 |
| 30 Sea surface | 93 | 0 | 0 |
| 35 Sea subsurface | 22 | 0 | 0 |
| 36 Mine warfare | 65 | 0 | 0 |
| 40 Activities | 152 | 0 | 0 |
| 50–54 SIGINT | 4 each | 0 | 0 |
| 60 Cyberspace | 43 | 0 | 0 |

The 364 invalid control measures are the **line and area** graphics (boundaries, axes of advance,
phase lines…), which milsymbol does not draw — it only renders *point* control measures.
Additionally **31 of 1 721 entities render a frame with no icon at all** (hierarchy placeholder codes
such as `10/120000`, `10/130000`, `20/120000`, `27/110000`) — these still report `isValid() === true`.
Detect them with `sym.asSVG() === new ms.Symbol(sidc,{icon:false}).asSVG()` if that matters. **[run]**

---

## 6. Headless / sandbox safety

### 6.1 Exhaustive grep of browser globals **[src]**

`grep -rE '\b(document|window|navigator|DOMParser|Image|OffscreenCanvas|Path2D|self|globalThis)\b' src/`
returns hits in exactly these places:

| File | Global | Live code? |
|---|---|---|
| `src/ms/symbol.js:94-95` | `document`, `DOMParser` | **yes** — `asDOM()` only |
| `src/ms/symbol/ascanvas.js:15,28` | `document` | **yes** — `asCanvas()` only |
| `src/ms/symbol/asoffscreencanvas.js:16,29` | `OffscreenCanvas` | **yes** — `asOffscreenCanvas()` only |
| `src/ms/symbol/canvasdraw.js` | `Path2D` | **yes** — canvas path only (guarded by `typeof`) |
| `src/ms/path2d.js` | — | comment only |
| `src/symbolfunctions/icon.js:105-131, 201-230` | `document` | **NO — entirely inside `/* … */` block comments** (verified by reading lines 85–240) |
| `src/ms.js:5` | `console`, `process` | guarded by `typeof` |

**No other file in `src/` touches any DOM global.** `asSVG()`, `getSize()`, `getAnchor()`,
`getOctagonAnchor()`, `getColors()`, `getMetadata()`, `getOptions()`, `getStyle()`, `isValid()`,
`setOptions()` and `toDataURL()` are pure JS string/number work.

### 6.2 Proof by execution **[run]**

`research/scratch/01-smoke.mjs`, run with bare `node` (no jsdom, no polyfill):

```
version: 3.0.4
typeof document: undefined  typeof window: undefined  typeof navigator: object
SVG length: 597
getSize: {"width":55.3,"height":47.425}
isValid: true
```
and `research/scratch/07-svg-inventory.mjs` rendered **1 439 508 symbols** via `asSVG()` in plain Node
with **zero** exceptions.

(`navigator` exists in Node ≥ 21 but milsymbol never reads it.)

### 6.3 What this means for the Figma plugin

* `asSVG()` is safe **everywhere** — including the Figma plugin **sandbox** (main thread), where
  `figma.createNodeFromSvg(svgString)` lives. You do **not** need to build the SVG in the UI iframe.
* If you do put milsymbol in the UI iframe, `asDOM()`/`asCanvas()` become available too — but you then
  have to `postMessage` the string across anyway, so there is no benefit.
* **Recommendation:** run milsymbol in the plugin sandbox (`code.js`), call `asSVG()`, and feed the
  string straight into `figma.createNodeFromSvg()`. No DOM shim, no message round-trip.

### 6.4 Performance **[run]**

```
5 000 symbols (warm icon cache), asSVG():        24.3 ms   (~0.005 ms each)
2 000 symbols with distinct monoColor (cold):   254.4 ms   (~0.13 ms each)
```
The icon cache key **[src]** `symbolfunctions/icon.js:29-56` is
`"standard:…,edition:…," + dimension + affiliation + notpresent + numberSIDC + ",frame:…,alternateMedal:…,colors:{…}"`.
It is **never evicted**. Rendering N symbols with N different `monoColor`/`colorMode` values creates
N cache entries (measured: 258 entries after 258 distinct colours). For a batch-generate plugin this
is fine; for a live colour-picker preview, throttle or call `ms.addIcons(std2525e)` occasionally to
clear `_iconCache` (that is the only non-`reset()` way to clear it). **[src]**

---

## 7. The exact SVG that `asSVG()` emits

### 7.1 Serialiser rules **[src]** `src/ms/symbol/assvg.js`

The draw-instruction tree maps 1:1 onto elements:

| Instruction `type` | Element emitted | Attributes written |
|---|---|---|
| `path` | `<path>` | `d` |
| `circle` | `<circle>` | `cx`, `cy`, `r` (all coerced through `Number.isFinite`, fallback 0) |
| `text` | `<text>` | `x`, `y`, `text-anchor` (default `start`), `font-size` (default 12), `font-family`, `font-weight` (only if valid), `dominant-baseline` (only if `alignmentBaseline` is a valid keyword) |
| `translate` | `<g transform="translate(x,y)">` | |
| `rotate` | `<g transform="rotate(deg,x,y)">` | |
| `scale` | `<g transform="scale(factor)">` | |
| `clip` | `<clipPath id=…><path clip-rule="nonzero"/></clipPath><g clip-path="url(#…)">` | never produced by the built-in icon set |
| any + `clipPath` prop | inline `<clipPath id="clip-inline-N">` + `clip-path="url(#…)"` | never produced by the built-in icon set |
| `svg` | raw fragment, passed through a blocklist (`script|foreignObject|iframe|object|embed`, `on*=`, `javascript:`) | never produced by the built-in icon set |

Paint attributes, added to any instruction type:

* `stroke-width` — emitted **only if `stroke` is defined**; value = `non_scaling_stroke × (strokewidth ?? style.strokeWidth)`
* `stroke-dasharray` — only if it matches `/^[0-9.,\s-]+$/`
* `stroke-linecap` **and** `stroke-linejoin` — both set from the same `linecap` value, only if it is `butt|round|square`
* `stroke` — `sanitizeColor(...)` or the literal `"none"` when falsy
* `fill` — only if the `fill` key is *defined*; falsy → `"none"`; `url(...)`, `javascript:` and `data:` are rejected
* `fill-opacity` — only if defined; clamped to `[0,1]`

Escaping **[src] [run]**: attribute values escape `& " ' < >` and collapse `\r\n\t` to a space;
**text content escapes only `& < >`** (quotes are left as-is, which is valid XML). Verified:
`uniqueDesignation: 'A&B<C>D"E\'F'` → `>A&amp;B&lt;C&gt;D"E'F</text>`.

XML hygiene **[run]**: output starts with `<svg `, has **no** XML declaration, **no** DOCTYPE, **no**
`xlink`, **no** `id=` attributes, **no** `style=` attributes, **no** `<defs>`.

### 7.2 Complete element + attribute inventory

Collected by rendering **1 439 508 symbols** — every symbol set, a 12-point sample of every entity
table, all 7 standard identities, statuses `0/1/2/4`, HQ/TF/FD `0/2/5`, amplifiers
`00/14/21/33/36/42/71`, plus 12 different option bundles (mono, unfilled, unframed, all 25 text
amplifiers, direction, speed leader, dark mode, opacity, styleFill, padding, square, outlines) and a
letter-SIDC sample. **[run]** `research/scratch/07-svg-inventory.mjs`

**Exactly five element types ever appear:**

| Element | Every attribute that can appear |
|---|---|
| `svg` | `xmlns`, `version`, `baseProfile`, `width`, `height`, `viewBox` — **always in that order** |
| `g` | `transform`, `stroke`, `stroke-width`, `fill` |
| `path` | `d`, `fill`, `fill-opacity`, `stroke`, `stroke-dasharray`, `stroke-linecap`, `stroke-linejoin`, `stroke-width` |
| `circle` | `cx`, `cy`, `r`, `fill`, `fill-opacity`, `stroke`, `stroke-dasharray`, `stroke-linecap`, `stroke-linejoin`, `stroke-width` |
| `text` | `x`, `y`, `text-anchor`, `font-size`, `font-family`, `font-weight`, `dominant-baseline`, `fill`, `stroke`, `stroke-linecap`, `stroke-linejoin`, `stroke-width` |

**Never emitted by the stock icon set:** `textPath`, `tspan`, `defs`, `use`, `symbol`, `clipPath`,
`mask`, `pattern`, `linearGradient`, `radialGradient`, `image`, `style`, `rect`, `line`, `polygon`,
`polyline`, `ellipse`, `marker`, `filter`, `title`, `desc`, `foreignObject`.
(`clipPath` is *supported* by the serialiser but nothing in `src/iconparts/**` or `src/numbersidc/**`
produces a `clip`/`clipPath` instruction — verified by grep **[src]** and by the sweep **[run]**.)

Observed value domains **[run]**:

| Attribute | Domain |
|---|---|
| `svg@version` | `1.2` (constant) |
| `svg@baseProfile` | `tiny` (constant) |
| `svg@xmlns` | `http://www.w3.org/2000/svg` (constant) |
| `g@transform` | `translate(x,y)` · `scale(f)` · `rotate(deg,100,100)` — one function per `<g>`, never a list |
| `g@fill` | `none` only |
| `text@font-family` | whatever `style.fontfamily` is, default `Arial` |
| `text@font-weight` | `bold` (or absent) |
| `text@dominant-baseline` | `middle` (or absent) |
| `text@text-anchor` | `start` · `middle` · `end` |
| `text@font-size` | `20, 22, 23, 25, 28, 30, 33, 35, 39, 40, 45, 60` with default options (plus whatever `infoSize` you set) |
| `*@stroke-dasharray` | `4,4` (pending) · `8,12` (anticipated) · `8,8` (feint/dummy) · `8,4` (hard-coded, `iconparts/subsurface.js:806,1000`) |
| `*@stroke-linecap` / `stroke-linejoin` | `round` only (outline pass) |
| `*@fill-opacity` | `1` by default, else `style.fillOpacity` |
| `*@fill` / `*@stroke` | `black`, `white`, `none`, `rgb(...)`, `rgba(255,255,255,0.4)`, plus the invalid `rbg(255, 188, 1)` (§8.1) |

Structural limits over the catalogue sweep **[run]**:
max `<svg>/<g>` nesting depth **6**, max element count per symbol **17**,
max SVG length **14 073 chars**, mean **1 525 chars**.

### 7.3 Paint inheritance — **critical for `createNodeFromSvg`**

Over 8 040 catalogue renders **[run]**, **4 824 `<g>` elements carry `stroke`/`fill`** and
**3 216 child `<path>` elements have no paint attributes at all** and rely on inheritance:

```xml
<g transform="translate(0,0)" stroke-width="4" stroke="black" fill="none" >
  <path d="M90,40L90,15" ></path>
  <path d="M110,40L110,15" ></path>
</g>
```
(that is the `II` battalion echelon marker). Mobility markers, HQ staffs and modifier groups use the
same pattern. Any SVG consumer that does **not** implement paint inheritance from `<g>` will render
these as invisible or black-filled shapes.

### 7.4 The outline pass doubles everything

With `style.outlineWidth > 0`, `ms.outline()` **clones every drawn element** into the `pre` array with
`fill` and `fillopacity` stripped, `stroke = outlineColor`, `linecap = "round"` and
`strokewidth = strokewidth + 2 × outlineWidth`. The SVG therefore contains **two copies of every path,
circle and `<text>`**, halo first. **[src]** `src/ms/outline.js` **[run]** (see the full example in §7.5).
For Figma this means every text amplifier becomes **two** nodes. Set `outlineWidth: 0` unless you
actually want halos.

### 7.5 A complete real output

`new ms.Symbol("14031000161211000000", { size:40, standard:"APP6", uniqueDesignation:"A/1-12 IN",
higherFormation:"2/3 BDE", additionalInformation:"SUPPORTING", staffComments:"FOR REINFORCEMENT",
type:"MECH", dtg:"301400ZSEP97", location:"0900000.0E570306.0N", quantity:"200", speed:"30KPH",
altitudeDepth:"GL", combatEffectiveness:"GREEN", reinforcedReduced:"(+)", evaluationRating:"A1",
iffSif:"M-2/3456", headquartersElement:"MAIN", direction:45, outlineWidth:2, engagementBar:"3:90:10",
engagementType:"TARGET", infoBackground:"rgb(230,230,230)" })` **[run]**

Root: `<svg xmlns="http://www.w3.org/2000/svg" version="1.2" baseProfile="tiny" width="514.4" height="114.8" viewBox="-563.6666666666665 -27 1286 287">`
`getSize() = {width: 514.4, height: 114.8}`, `getAnchor() = {x: 265.4666666666666, y: 50.8}`.
Body (abridged, order preserved):

```
<g transform="translate(0,150)"><g transform="rotate(45,100,100)">
  <path d="M100,100 l0,-75 -5,3 5,-15 5,15 -5,-3" stroke-width="8" stroke-linecap="round"
        stroke-linejoin="round" stroke="rgb(239, 239, 239)" fill="none"></path></g></g>   <- outline of direction arrow
<path d="M 100,150l0,100" stroke-width="8" … stroke="rgb(239, 239, 239)" fill="none"></path>
<text x="100" y="40" text-anchor="middle" font-size="40" font-family="Arial" stroke-width="4"
      stroke-linecap="round" stroke-linejoin="round" stroke="rgb(239, 239, 239)" fill="none">200</text>
…  (outline copies of every text + the info background boxes)
<path d="M25,50 l150,0 0,100 -150,0 z" stroke-width="4" stroke="black" fill="rgb(128,224,255)" fill-opacity="1"></path>   <- frame
<path d="M25,50 L175,150 M25,150 L175,50" stroke-width="3" stroke="black" fill="black"></path>            <- infantry icon
<g transform="translate(0,0)" stroke-width="4" stroke="black" fill="none">
  <path d="M90,40L90,15"></path><path d="M110,40L110,15"></path></g>                                       <- "II" echelon
<path d="M25,4 l150,0 0,-25 -150,0 z" stroke-width="4" stroke="black" fill="rgb(255, 0, 0)"></path>        <- engagement bar
<text x="100" y="-1" … font-weight="bold" fill="black">3:90:10</text>
<text x="100" y="40" … fill="black">200</text>
<text x="100" y="185" … font-weight="bold" fill="black">MAIN</text>
<path d="M -557.666…,20 -537.666…,0 15,0 15,210 -557.666…,210z" stroke="rgb(230,230,230)" fill="rgb(230,230,230)"></path>
<text x="5"   y="40"  text-anchor="end"   …>301400ZSEP97</text>
<text x="5"   y="80"  text-anchor="end"   …>GL/0900000.0E570306.0N</text>
<text x="5"   y="120" text-anchor="end"   …>MECH</text>
<text x="5"   y="160" text-anchor="end"   …>A/1-12 IN</text>
<text x="5"   y="200" text-anchor="end"   …>30KPH</text>
<text x="195" y="40"  text-anchor="start" …>(+)</text>
<text x="195" y="80"  text-anchor="start" …>FOR REINFORCEMENT</text>
<text x="195" y="120" text-anchor="start" …>SUPPORTING</text>
<text x="195" y="160" text-anchor="start" …>2/3 BDE</text>
<text x="195" y="200" text-anchor="start" …>A1/GREEN/M-2/3456</text>
<g transform="translate(0,150)"><g transform="rotate(45,100,100)">
  <path d="M100,100 l0,-75 -5,3 5,-15 5,15 -5,-3" stroke-width="4" stroke="black" fill="black"></path></g></g>
<path d="M 100,150l0,100" stroke-width="4" stroke="black" fill="black"></path>
```

Note the draw order: **all outline (`pre`) geometry first, then all real (`post`) geometry**, and the
info-background boxes are painted **after** `quantity`/`headquartersElement`, so a long `quantity`
string can be partially covered by the left/right background polygons.

### 7.6 Figma `createNodeFromSvg` checklist

`figma.createNodeFromSvg(svg: string): FrameNode` (`@figma/plugin-typings/plugin-api.d.ts:1703`) **[src]**

| Feature milsymbol emits | Notes for Figma |
|---|---|
| `<svg version="1.2" baseProfile="tiny">` | non-standard-but-harmless attributes |
| non-integer `width`/`height`, negative `viewBox` origin | fine, but round the values if you want tidy frame sizes |
| `<g transform="translate|scale|rotate">` nested up to 6 deep | maps to nested `FrameNode`/`GroupNode` |
| **paint inheritance from `<g>`** (§7.3) | **must** be honoured — verify on an echelon-amplified symbol (`amp = "16"` gives the `II` group) |
| `stroke-dasharray` (`4,4`, `8,12`, `8,8`, `8,4`) | maps to `dashPattern` |
| `fill-opacity` | maps to fill opacity |
| `stroke-linecap` + `stroke-linejoin` = `round` (outline pass only) | |
| `<circle>` | |
| `<text>` with `font-family="Arial"`, `font-size`, `font-weight="bold"`, `text-anchor`, `dominant-baseline="middle"` | **The main risk.** Figma's SVG importer's handling of `<text>` (text node vs outlined vector) and of `dominant-baseline`/`text-anchor` is **[UNVERIFIED]** here. Test early with a fully-amplified symbol. If it produces `TextNode`s you must `await figma.loadFontAsync({family:"Arial", style:"Regular"})` **and** `{style:"Bold"}` before the call, and Arial must exist on the user's machine. |
| Empty `<g …></g>` | occurs ~56 times per 13 768 renders without `stack`, and 2 per `stack` level — they become empty frames; prune with a regex `/<g[^>]*>\s*<\/g>/g` before import |
| The outline pass duplicates every element (§7.4) | avoid by `outlineWidth: 0` |

**Mitigation if `<text>` imports badly:** render with `infoFields: false` (no amplifiers) and lay the
text out yourself with Figma `TextNode`s, using the L1–L5 / R1–R5 coordinates from §1.4 mapped through
the `viewBox`. All non-text geometry is pure `path`/`circle`/`g`.

---

## 8. Known bugs and quirks

### 8.1 Confirmed bugs in 3.0.4

| # | Bug | Evidence | Impact / workaround |
|---|---|---|---|
| 1 | **`FrameColor.Suspect` is `"rbg(255, 188, 1)"`** — `rbg`, not `rgb` | `src/colormodes.js:26` **[src]**; `new ms.Symbol("13051000001211000000",{fill:false}).asSVG()` → `stroke="rbg(255, 188, 1)"` **[run]** | Invalid CSS colour on **unfilled 2525E suspect symbols**. Fix at startup: `const fc = ms.getColorMode("FrameColor"); fc.Suspect = "rgb(255, 188, 1)"; ms.setColorMode("FrameColor", fc);` |
| 2 | **Suspect is recognised only for version `13`** — `if (version == 13 && standardIdentity2 == 5)` | `src/numbersidc/metadata.js:30` **[src]**; `14051000001211000000` → `metadata.suspect === undefined`, renders as plain Hostile red **[run]** | **Hits this plugin directly**: APP‑6E SIDCs start with `14`, so suspect symbols never get the amber suspect colour. 24 094-render diff shows this is the *only* difference between version 13 and 14. Workaround: emit version `13` internally, or patch `metadata` via a custom symbol part. |
| 3 | **`getSize()` calls a non-existent `this.updateSymbol()`** | `src/ms/symbol/getsize.js:3` **[src]**; `new ms.Symbol().getSize()` → `TypeError: this.updateSymbol is not a function` **[run]** | Never construct with zero args. |
| 4 | **`ms.reset()` bricks the library** | **[run]** — next construction throws `TypeError: Cannot read properties of undefined (reading '')` at `icon.js:252` | Never call `reset()`; if you must, re-run `ms.addIcons(...)`. |
| 5 | **`style.infoBackgroundFrame` is dead** — the code reads `style.infoBackground` for the frame colour | `src/symbolfunctions/textfields.js:28-33` **[src]**; setting `infoBackground:"rgb(1,1,1)", infoBackgroundFrame:"rgb(2,2,2)"` yields `stroke="rgb(1,1,1)"` **[run]** | Background boxes always get a stroke of the background colour. |
| 6 | **`country` is missing from the "do we have text?" gate** | `src/symbolfunctions/textfields.js` `textFields = quantity \|\| … \|\| specialDesignator` (no `country`) **[src]**; `{country:"USA"}` alone renders nothing, `{country:"USA", type:"T"}` renders `USA` **[run]** | Always set at least one other amplifier, or patch the gate. |
| 7 | **`options.sigint` (R2) and `options.auxiliaryEquipmentIndicator` (AG) are never drawn** | no assignment anywhere in `textfields.js` **[src]**; no output change **[run]** | Fields AG and R2 are unimplemented; render them yourself if required. |
| 8 | **`style.frameColor` / `style.iconColor` silently ignore strings** | `typeof … === "object"` guards in `getcolors.js` **[src] [run]** | Always pass `ms.ColorMode(...)` objects. (`fillColor`, `infoColor`, `outlineColor`, `infoBackground` *do* accept strings.) |
| 9 | **`metadata.fenintDummy`** — typo in `getmetadata.js`; the real flag set later is `feintDummy` | `src/ms/symbol/getmetadata.js:23` vs `src/numbersidc/metadata.js:213` **[src]** | Read `metadata.feintDummy`, not `fenintDummy`. |
| 10 | **`getColors()` mutates a user-supplied `colorMode` object** for civilian/joker/suspect symbols | `src/ms/symbol/getcolors.js:29-52` **[src]** | Pass a freshly built object per render, or a palette **name**. |
| 11 | **`package.json` `exports` blocks `milsymbol/index.mjs`** | esbuild: `The path "./index.mjs" is not exported by package "milsymbol"` **[run]** | Import by relative path or alias if you want tree-shaking. |
| 12 | `ms.setStandard` is case-sensitive and returns `false` (silent no-op) for anything but `"2525"`/`"APP6"` | **[run]** `setStandard("app6") === false` | Check the return value. |
| 13 | `style.standard` accepts only `"APP6"`; **any other non-empty value, including `"APP6E"`, means 2525** | `metadata.STD2525 = this.style.standard == "APP6" ? false : true` **[src] [run]** | Use the exact string `"APP6"`. |
| 14 | `_iconCache` is unbounded and only cleared by `addIcons()`/`reset()` | **[src] [run]** 258 entries after 258 distinct `monoColor` values | Avoid per-render unique colours in interactive previews. |
| 15 | `asSVG()` re-serialises on every call (no memoisation, despite writing `this.XML`) | `src/ms/symbol/assvg.js` **[src]** | Cache the string yourself. |
| 16 | `getMetadata()` / `getColors()` **recompute** rather than returning `this.metadata` / `this.colors`, and `getMetadata()` mutates `this.options.sidc` | **[src]** | Prefer `sym.metadata` / `sym.colors` for read-only access. |
| 17 | **Rendering is order-dependent: one symbol can permanently change another's output.** `ms._scale()` writes `non_scaling_stroke` **in place** onto the instruction objects stored in `ms._iconCache`, and those objects are shared between entities of the same symbol set | `src/ms.js` `_scale` → `recurse_scale` **[src]**; two-line repro **[run]** below | Clear the cache with `ms.addIcons([])` (verified to fix it **[run]**) at deterministic points, or accept that identical inputs may produce slightly different `stroke-width`s depending on render order. |

#### Bug #17 — minimal reproduction **[run]**

```js
import ms from "milsymbol";
const A = "10031500001301000000";   // v10 (edition D), Land equipment, entity 130100
const B = "13031500001301000000";   // v13 (edition E), same entity
const T = "13031500001302000000";   // v13, entity 130200 — the trigger

new ms.Symbol(A,{standard:"APP6"}).asSVG() === new ms.Symbol(B,{standard:"APP6"}).asSVG();  // true
new ms.Symbol(T,{standard:"APP6"}).asSVG();                                                 // side effect
new ms.Symbol(A,{standard:"APP6"}).asSVG() === new ms.Symbol(B,{standard:"APP6"}).asSVG();  // FALSE
```

The difference is the icon stroke width — `stroke-width="3.75"` becomes `stroke-width="3"`:

```
<path d="m 70,115 10,-10 40,0 10,10 m -60,-30 10,10 40,0 10,-10" stroke-width="3.75" …>   before
<path d="m 70,115 10,-10 40,0 10,10 m -60,-30 10,10 40,0 10,-10" stroke-width="3"    …>   after
```

`ms.addIcons([])` (which does `this._iconCache = {}`) restores the cold behaviour, and rendering `T`
again re-breaks it — proving the icon cache is the carrier. **[run]** `research/scratch/17..20-*.mjs`

### 8.2 Behavioural quirks worth guarding

* **Invalid entity codes never throw** — they draw a question-mark glyph. Always gate on `isValid()`.
* **`style.size < 10`** silently raises frame `stroke-width` from `strokeWidth` to `10`. **[run]**
* **`square: true`** squares the bbox around the *anchor*, so a symbol with wide amplifier text
  becomes enormous (`958 × 958` observed for a 12-character `uniqueDesignation`). **[run]**
* **`infoFields: false` also kills the direction arrow**, not just the text. **[src]**
* **`speedLeader` is in output pixels**, everything else is in symbol units. **[src]**
* **Text width estimation** only knows Latin + Cyrillic; other scripts default to 28.5 units/char and
  the bbox will be wrong. **[src]**
* **Symbol set 36 (mine warfare)**: `alternateMedal:false` (the default) forces `metadata.fill = false`,
  so mines render unfilled regardless of `style.fill`. **[src]**
* **Sea own-track (`30` + entity `150000`)** forces `metadata.frame = false`. **[src]**
* **Modifier-driven icon scaling:** when modifier 1 and/or 2 are present the main icon is wrapped in
  `translate`+`scale` groups (`0.45` for both, `0.7` for one) with `non_scaling_stroke`, which produces
  fractional `stroke-width` values such as `5.5`, `1.5`. **[src]** `symbolfunctions/icon.js:311-338`
* **Entity subtype `95`–`98`** (positions 15–16) append the fixed HQ / division-support / corps-support /
  theatre-support glyphs, and an unknown subtype `≥95` falls back to `entity.substr(0,4)+"00"`. **[src]**
* **`mil-std-2525` (the D-edition catalogue) is NOT installed** in this project —
  `node_modules/` contains only `milsymbol` and `milstandard-e`. The D-vs-E comparison in §3.5 was made
  with milsymbol's own icon tables instead. **[run]**

---

## 9. Recommended plugin integration

```js
// code.js (Figma plugin sandbox — no DOM needed, see §6.3)
import ms from "milsymbol";                // or the tree-shaken subset, see §0.1

ms.setStandard("APP6");                    // returns true; verify it
// Bug #1 workaround — fix the Suspect frame colour typo once at startup
{ const fc = ms.getColorMode("FrameColor"); fc.Suspect = "rgb(255, 188, 1)";
  ms.setColorMode("FrameColor", fc); }

export function render(sidc, opts = {}) {
  const sym = new ms.Symbol(sidc, {
    standard: "APP6",                      // per-symbol, so global state can't leak
    size: 100,
    outlineWidth: 0,                       // avoid duplicated nodes (§7.4)
    ...opts,
  });
  if (!sym.isValid()) {
    throw new Error("Unrenderable SIDC " + sidc + ": " + JSON.stringify(sym.isValid(true)));
  }
  const svg = sym.asSVG().replace(/<g[^>]*>\s*<\/g>/g, "");   // drop empty groups (§7.6)
  return {
    svg,
    size: sym.getSize(),                   // output px
    anchor: sym.getAnchor(),               // map point, px from top-left
    octagonAnchor: sym.getOctagonAnchor(), // frame centre, px from top-left
    metadata: sym.metadata,                // already computed; don't call getMetadata() again
  };
}

// then, in the sandbox:
// const node = figma.createNodeFromSvg(render(sidc).svg);
```

### Checklist before shipping
1. Confirm how Figma imports `<text>` (§7.6) with a fully-amplified symbol — this is the only
   **[UNVERIFIED]** item in this document.
2. Emit APP‑6E version digits `14`, but be aware of bug #2 (suspect). If suspect rendering matters,
   translate `14…` → `13…` internally before calling milsymbol.
3. Always use `standard: "APP6"` — exact string, exact case.
4. Gate everything on `isValid()`; symbol set 25 has 364 unrenderable (line/area) entities.
5. Never call `ms.reset()`.
6. If byte-for-byte reproducible SVG matters (snapshot tests, caching by SIDC hash), clear the icon
   cache with `ms.addIcons([])` before each batch — see bug #17.

---

## 10. Probe scripts

| File (under `research/scratch/`) | What it proves |
|---|---|
| `01-smoke.mjs` | headless render, API surface listing |
| `lib-sidcs.mjs` | TSV → entity-code / entity-name helpers, SIDC builder |
| `03-std-diff.mjs` | 12 047-render 2525 vs APP6 diff, counts per symbol set |
| `04-std-diff-detail.mjs` | the 152-entity diff table in §3.4 |
| `05-std-diff-amplifiers.mjs` | modifier / echelon / status / HQ / context / version sweeps |
| `06-inspect.mjs` | first-divergence inspection for representative diffs |
| `07-svg-inventory.mjs` | 1 439 508-render element + attribute inventory (§7.2) |
| `08b-suspect.mjs` | bugs #1 and #2 |
| `09-version-diff.mjs` | version 13 vs 14, edition D vs E |
| `10-dumps.mjs` | full return shapes of every getter (§5) |
| `11-amplifier-effect.mjs` | per-field × per-symbol-set amplifier matrix (§1.3) |
| `12-edge.mjs` | escaping, fontfamily sanitisation, size/padding/square/outline behaviour |
| `13-misc.mjs` | setOptions semantics, the full amplified example (§7.5) |
| `14-inherit.mjs` | `<g>` paint-inheritance statistics (§7.3) |
| `15-validity.mjs` | per-symbol-set validity and icon-coverage sweep (§5.12) |
| `16-cache-pollution.mjs`, `16b.mjs`, `19-bisect.mjs`, `20-repro.mjs` | isolation and minimal repro of bug #17 |
| `17-pollution.mjs`, `18-scale-mutation.mjs` | negative controls while hunting bug #17 |
| `bundle/` | esbuild tree-shaking measurements (§0.1) |
