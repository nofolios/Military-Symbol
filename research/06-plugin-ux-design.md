# 06 — UX and Feature Design for the APP-6E Figma Plugin

**Status:** implementation spec.
**Date:** 2026-09-17.
**Scope:** what the plugin must do, exactly how the UI behaves, the iframe↔sandbox message contract, persistence, node naming, ergonomics, and the traps.

## 0. How to read this document, and what is verified

Every numeric claim below is tagged:

| Tag | Meaning |
|---|---|
| **[RAN]** | I executed code against the installed packages and copied the output. Scripts live in `research/scratch/`. |
| **[SRC]** | I read the library source in `node_modules` and am quoting behaviour from it. |
| **[DOC]** | From official Figma / vendor documentation fetched during research. |
| **[INF]** | Design decision or inference. Not verified by execution. Flagged individually. |
| **[VERIFY]** | Cannot be verified outside a live Figma session. Must be checked during implementation. Each one has a fallback. |

Versions in play **[RAN]**:

- `milsymbol@3.0.4`, MIT, `"type": "module"`, ESM entry `index.js`, CJS `dist/milsymbol.js` (861 713 bytes minified), dev bundle 1 381 569 bytes.
- `milstandard-e@0.2.14`, MIT, `milstandard.esm.js` = 105 691 bytes (TSV tables inlined by `rollup-plugin-string`).
- `mil-std-2525@0.2.8` present as the D-edition comparison catalog.

---

## 1. What exists today, and what is missing

### 1.1 Landscape

| Tool | What it does well | What it cannot do for a Figma user |
|---|---|---|
| **milsymbol demo / spatialillusions.com Battle Staff Tools** | Canonical renderer. Supports 2525C/D/E and APP-6 B/D/E. Full amplifier set. SVG and Canvas output. **[SRC: milsymbol README]** | Web page only. Output is a single flattened SVG blob. No layer structure, no components, no re-edit, no Figma awareness. |
| **symbol.army (Easy Symbol)** | Base-symbol search by 2525 name or equipment name, funnel filter, modifier toolbar with contextual hint text, N-point tactical graphic editor, exports SVG/EMF/XAML/BMP/JPEG/PNG/ICO, share-by-URL. **[DOC]** | One symbol at a time. No batch, no collections, no ORBAT. Round-trip into Figma is download → drag → re-import, and the result is an unnamed vector soup. |
| **ORBAT Mapper** | Standard selection (2525 vs APP-6), custom unit symbols, letter→number SIDC conversion via `convert-symbology`, ORBAT tree as a first-class object. **[DOC]** | It is a map/scenario app. Its output is a scenario file, not design assets. |
| **milsymb.net explorer** | Symbol-set browser, frame browser, search. **[DOC]** | Read-only reference. |
| **Luciad, Nobori, MGRS Mapper** | Production C2/GIS symbology engines. **[DOC]** | Not design tools. |
| **Figma Community** | Searched for `military symbol`, `MIL-STD-2525`, `APP-6`, `milsymbol`, `NATO symbology` on 2026-09-17. **Found: nothing.** Only unrelated assets — an "ARMY" community *file* and a "Military Vehicles Icon Pack" *file*, no plugin. **[DOC — web search, not an exhaustive crawl of the Community index]** | — |

### 1.2 The actual gap

A designer building a COP mockup, ORBAT chart or briefing slide today does one of:

1. Screenshot a generator and paste a raster image → unusable at print size, wrong colours, cannot recolour.
2. Download SVG per symbol → 40 downloads for a brigade ORBAT, every one lands as `Group 12` containing 9 unnamed vectors, text is outlined, nothing is reusable.
3. Hand-draw the frames from a template library → wrong geometry, no icon fidelity, breaks the moment the echelon changes.

**Nobody bridges "the standard" to "a Figma document that behaves like a design system."** That bridge is this plugin's entire reason to exist, and it is what every feature below must serve:

> A symbol inserted by this plugin must be a **named, structured, re-editable, variant-aware Figma node** — not a picture of a symbol.

---

## 2. Prioritised feature list

### MUST — without these the plugin is not worth installing

| # | Feature | Why it is a MUST | Key verified fact |
|---|---|---|---|
| M1 | **SIDC builder with dependent dropdowns** (Version → Context → Standard Identity → Symbol Set → Status → HQ/TF/FD → Echelon/Mobility → Entity → Entity Type → Entity Subtype → Modifier 1 → Modifier 2) | This is the product. Nobody memorises 20-digit codes. | Digit layout confirmed against `src/numbersidc/metadata.js` **[SRC]**, all digit semantics enumerated in §9.2 **[RAN]** |
| M2 | **Fuzzy search over the full entity catalog** | 1 721 main icons + 1 068 modifier rows = **2 789 selectable rows**. Drilling is too slow as the primary path. | **[RAN]** `probe7.mjs` |
| M3 | **Live preview** with the exact SVG that will be inserted | Users must see the symbol before committing. Cost is negligible. | 500 full `asSVG()` renders in **7 ms** **[RAN]** `probe4.mjs` |
| M4 | **Insert at viewport centre, or into the current selection** | The two things a designer actually wants. Anything else is a extra drag operation. | `figma.viewport.center`, `figma.currentPage.selection` **[DOC]** |
| M5 | **Structured, named node output** (see §6) | This is the single differentiator vs. downloading an SVG. | — |
| M6 | **Re-edit an existing symbol on canvas via plugin data** | Symbols are wrong on first pass ~always. Echelon changes, affiliation changes, HQ flag gets added. | `setPluginData`, entry ≤ **100 kB** (pluginId+key+value), enforced since 2025-03-17 **[DOC]** |
| M7 | **Size / stroke / fill / frame / icon toggles** | `size`, `strokeWidth`, `fill`, `frame`, `icon`, `outlineWidth`, `square`, `padding`, `fillOpacity` all verified to change output. | **[RAN]** `probe4.mjs` |
| M8 | **Text amplifier form** rendered as **native Figma TextNodes** | Figma's SVG importer outlines or drops `<text>`. Non-negotiable — see §8.1. | Figma forum reports: SVG text imports as per-letter vectors; `textPath` never imports; `letter-spacing` ignored **[DOC]** |
| M9 | **Monochrome + custom colour modes** | Every briefing template is either black-on-white or a dark COP. | `monoColor`, `fillColor`, `iconColor`, `frameColor`, `colorMode: Light/Medium/Dark` all verified **[RAN]** |
| M10 | **Dark/light theming of the panel via `themeColors: true`** | Table stakes for a 2026 plugin. | `figma.showUI(html, {themeColors: true})` injects `<style id="figma-style">` and adds `figma-light` / `figma-dark` to `<html>` **[DOC]** |
| M11 | **Validity gating** — never insert a symbol that renders as an empty frame | `isValid()` alone is insufficient. See §8.3. | Standard-identity digits `7`,`8`,`9` return `isValid() === true` but produce `affiliation: "undefined"` and **no frame and no fill** **[RAN]** `probe14.mjs` |

### SHOULD — these are what make it stick

| # | Feature | Notes |
|---|---|---|
| S1 | **Batch insert as a grid** | Multi-select in the browse list → insert as an auto-layout wrap grid with per-cell labels. Uses fixed-size cells because symbol bounds vary by up to **34 %** between sets (47.2 px vs 63.2 px at `size:40, square:true`) **[RAN]** `probe5.mjs`. |
| S2 | **Generate a component set with affiliation variants** | `figma.combineAsVariants(nodes, parent)` — "must consist of only component nodes" **[DOC]**. Variants: `Affiliation=Friend \| Hostile \| Neutral \| Unknown \| Pending \| Assumed Friend \| Suspect`. |
| S3 | **Swap affiliation of selected symbols in place** | Read `setPluginData` → mutate SIDC digit 4 → re-render → replace children, keep node id, name, position, and parent constraints. |
| S4 | **Paste a list of SIDCs** | Accept 20/22/24/30-char numeric **and** 12/15-char legacy letter SIDCs — all verified valid **[RAN]** `probe9.mjs`, `probe12.mjs`. One per line, optional `,label` suffix. |
| S5 | **Favourites and recents** | `figma.clientStorage`, 5 MB total per plugin **[DOC]**. |
| S6 | **Export SVG to clipboard** | Copy the *unflattened, amplifier-free* SVG string. Must happen in the iframe — the sandbox has no clipboard. |
| S7 | **Keyboard-driven quick insert** via manifest `parameters` | `figma.parameters.on('input', ({key, query, result}) => result.setSuggestions([...]))` then `figma.on('run', ({parameters}) => ...)`; `"parameterOnly": false` lets the plugin also open normally **[DOC]**. |
| S8 | **Relaunch button on inserted nodes** | `node.setRelaunchData({edit: "Edit APP-6E symbol"})`, description ≤ 1000 chars, manifest needs `"relaunchButtons": [{"command":"edit","name":"Edit symbol"}]` **[DOC]**. |
| S9 | **Symbol sheet / legend generator** | From the current page's plugin-data'd symbols, or from a selected set: a deduplicated table `[symbol] [name] [SIDC]`. |

### COULD — differentiators, ship later

| # | Feature | Notes |
|---|---|---|
| C1 | **ORBAT tree from indented text** | Tab/2-space indentation → nested auto-layout with connector lines. The single highest-leverage COULD: it turns a 2-hour manual job into 5 seconds. |
| C2 | **Tactical graphics / control measures** (symbol set `25`) | 628 main icons **[RAN]** — the largest single set, but most are multi-point graphics that do not make sense as a point symbol. Ship only the point-type subset first. |
| C3 | **Save/load named presets** ("my brigade's default style"). |
| C4 | **Convert selection to component set** (take N loose symbols already on canvas, promote to a set). |
| C5 | **Sync to Figma variables** for the six affiliation fills, so a whole deck recolours from one variable change. |
| C6 | **Direction-of-movement indicator** control. Verified but quirky — see §8.6. |
| C7 | **Mobility / towed-array indicator picker** for equipment (digits 9–10, set `15`) **[RAN]** `probe10.mjs`. |

### Explicitly NOT doing (v1)

- Map projection / geo-placement. Figma is not a GIS.
- Multi-point tactical graphics editor (symbol.army already does this, and Figma's vector API makes it painful).
- Raster export. Figma's own export does this better.

---

## 3. Screen-by-screen UI spec

### 3.0 Panel envelope

```ts
figma.showUI(__html__, {
  width: 420,
  height: 640,
  themeColors: true,
  title: "APP-6E Symbols",
});
```

- **420 × 640** default. Rationale: 420 px fits a 2-column control grid plus a 132 px preview gutter without horizontal scrolling; 640 px fits ~9 browse rows. Figma minimum is width 70 / height 0 **[DOC]**.
- **Resizable.** A drag handle in the bottom-right corner posts `{type:"ui:resize", width, height}`; the sandbox calls `figma.ui.resize(w, h)` clamped to `[360, 900] × [480, 1200]`. Persist to `clientStorage` key `ui.size`.
- **Root layout:** fixed 40 px tab bar, fixed 44 px search bar (Browse tab only), scrollable body, fixed 56 px action bar pinned to the bottom. The action bar never scrolls away — inserting is the point of the panel.

```
┌──────────────────────────────────────────────┐ 420px
│ Browse │ Build │ Amplifiers │ Style │ Batch  │ 40px  tab bar
├──────────────────────────────────────────────┤
│ 🔍 search…                          [filter] │ 44px
├──────────────────────────────────────────────┤
│                                              │
│   scrollable body                            │ flex
│                                              │
├──────────────────────────────────────────────┤
│ [preview 88×88]  1303100014…  [Insert ⏎]     │ 56px  action bar
└──────────────────────────────────────────────┘ 640px
```

### 3.1 Tab bar

Five tabs. Tab state persists in `clientStorage` key `ui.activeTab`.

| Tab | Shortcut | Purpose |
|---|---|---|
| **Browse** | `⌘1` | Search + drill the catalog. Default tab on first run. |
| **Build** | `⌘2` | The 12 dependent dropdowns. |
| **Amplifiers** | `⌘3` | Text amplifier form. |
| **Style** | `⌘4` | Size, stroke, colour, fill/frame/icon. |
| **Batch** | `⌘5` | Paste SIDCs, grid insert, component set, symbol sheet, ORBAT. |

The **preview + SIDC + Insert** action bar is shared across all five tabs and always reflects the single current working symbol (`state.sidc` + `state.options`). This is the key coherence decision: tabs are *views onto one symbol*, not separate modes.

### 3.2 Browse tab

**Search input** (44 px bar)

| Property | Value |
|---|---|
| Placeholder | `Search 2,789 entities and modifiers…` |
| Autofocus | yes, on panel open and on `⌘1` |
| Debounce | **80 ms** (not for CPU — 20 full-catalog fuzzy passes take **8 ms** total **[RAN]** — but to avoid re-rendering the virtual list on every keystroke) |
| Clear | `Esc` clears the query; a second `Esc` closes the plugin |
| Filter chip button | opens a popover with: Symbol set (multi-check, 21 entries), Affiliation (single, applied to results' preview), "Hide disused/reserved" (default **on**, hides 48 rows matching `/\{?Disused\}?\|Reserved/i` **[RAN]**) |

**Ranking.** Score each row against the query:

```ts
// verified: 20 passes over all 1721 entity rows = 8 ms  [RAN probe7.mjs]
function score(q: string, label: string): number {
  const s = label.toLowerCase();
  if (s === q) return 1000;
  if (s.startsWith(q)) return 500 - s.length;
  const wordStart = new RegExp(`\\b${escapeRe(q)}`).test(s);
  if (s.includes(q)) return (wordStart ? 300 : 150) - s.length;
  // subsequence fallback
  let qi = 0, sc = 0;
  for (let i = 0; i < s.length && qi < q.length; i++) {
    if (s[i] === q[qi]) { qi++; sc += (i === 0 || s[i-1] === " " || s[i-1] === "/") ? 3 : 1; }
  }
  return qi === q.length ? sc : -1;
}
```

Boost recents by `+40`, favourites by `+80`. Ties break by symbol-set order then code.

**Result list** — virtualised (see §7.3). Row height **56 px**.

```
┌────────────────────────────────────────────────┐
│ ▣  Infantry                                  ★ │  ← 32×32 preview, name, fav toggle
│    Land unit · Movement and Manoeuvre          │  ← breadcrumb, 11px, text-secondary
└────────────────────────────────────────────────┘
```

- The 32×32 preview is the entity rendered at `{size: 26, square: true}` with the **currently selected affiliation** from the Style tab, so the list reflects what you'd get.
- Row click → sets `state.sidc` entity digits, updates the action-bar preview, does **not** insert.
- Row double-click, or `Enter` on a keyboard-focused row → insert immediately.
- `★` toggles favourite.
- Breadcrumb is `Entity / Entity Type / Entity Subtype` joined with ` / `, minus the leaf. Source rows have exactly these three columns plus `Code` and `Remarks` **[RAN]**.

**Empty query state:** show three sections — `Favourites` (up to 12), `Recent` (up to 12), `Common` (a curated 24: infantry, armour, artillery, recon, engineer, medical, signal, supply, HQ, UAV, attack helo, fixed-wing fighter, SAM, mortar, sniper, EOD, MP, CBRN, ISR, logistics, fuel, maintenance, transport, C2).

**Empty result state:** `No match for "xyz". Try a SIDC, or clear the filters.` If the query looks like a SIDC (`/^[0-9]{10,30}$/` or `/^[A-Z*\-]{10,15}$/i`), show a single row: `Use this SIDC directly →`.

### 3.3 Build tab

Twelve controls in a two-column grid, all `<select>` except where noted. Each is a native `<select>` styled with Figma theme variables — native selects give free keyboard navigation and type-ahead, which a custom dropdown would have to reimplement badly.

| # | Label | Digits | Options | Default | Dependency |
|---|---|---|---|---|---|
| 1 | Standard version | 1–2 | `13 — APP-6E / 2525E`, `14 — APP-6E (alt)`, `10 — APP-6D / 2525D` | `13` | Changing 13↔10 re-filters the entity catalog (E vs D tables) and warns if the current entity has no D equivalent. `13`/`14` → edition **E**; `10`/`11`/`12` → edition **D** **[SRC `metadata.js:23-28`]** |
| 2 | Context | 3 | `0 Reality`, `1 Exercise`, `2 Simulation` | `0` | none **[RAN]** |
| 3 | Standard identity | 4 | `0 Pending`, `1 Unknown`, `2 Assumed Friend`, `3 Friend`, `4 Neutral`, `5 Suspect/Joker`, `6 Hostile/Faker` | `3` | **Must be limited to 0–6.** `7`/`8`/`9` parse as valid but render frameless and colourless **[RAN]** |
| 4 | Symbol set | 5–6 | 21 entries, see §9.1 | `10 Land unit` | **Resets entity, mod1, mod2.** Also swaps the echelon/mobility control (#6) between echelon list and mobility list. |
| 5 | Status / condition | 7 | `0 Present`, `1 Planned/Anticipated`, `2 Fully capable`, `3 Damaged`, `4 Destroyed`, `5 Full to capacity` | `0` | `1` renders a dashed frame **[RAN]** |
| 6 | HQ / Task force / Feint | 8 | `0 None`, `1 Feint/Dummy`, `2 HQ`, `3 Feint HQ`, `4 Task force`, `5 Feint TF`, `6 TF HQ`, `7 Feint TF HQ` | `0` | Odd digits add `stroke-dasharray`; 2,3,6,7 set `headquarters`; 4,5,6,7 set `taskForce` **[RAN]** |
| 7a | Echelon *(unit-type sets)* | 9–10 | `00 None`, `11 Team/Crew`, `12 Squad`, `13 Section`, `14 Platoon/detachment`, `15 Company/battery/troop`, `16 Battalion/squadron`, `17 Regiment/group`, `18 Brigade`, `21 Division`, `22 Corps/MEF`, `23 Army`, `24 Army Group/front`, `25 Region/Theater`, `26 Command` | `00` | shown for sets `10`, `11` **[RAN]** |
| 7b | Mobility *(equipment sets)* | 9–10 | `00 None`, `31 Wheeled limited cross country`, `32 Wheeled cross country`, `33 Tracked`, `34 Wheeled and tracked`, `35 Towed`, `36 Rail`, `37 Pack animals`, `41 Over snow`, `51 Barge`, `52 Amphibious`, `61 Short towed array`, `62 Long towed array` | `00` | shown for set `15` **[RAN]** |
| 8 | Entity | 11–12 | distinct `Entity` values for the chosen set | — | resets 9, 10 |
| 9 | Entity type | 13–14 | rows sharing the chosen `Entity` | `00` | resets 10 |
| 10 | Entity subtype | 15–16 | rows sharing Entity+Type | `00` | — |
| 11 | Modifier 1 | 17–18 | set-specific `modifier1` ∪ `common.modifier1` (67 rows) | `00` | grouped `<optgroup>` by the `Category` column (`Mobility`, `Capability`, …) |
| 12 | Modifier 2 | 19–20 | set-specific `modifier2` ∪ `common.modifier2` (26 rows) | `00` | same |

**Raw SIDC field.** Below the grid, a monospace `<input>` showing the full code, editable. On `input`: validate, and if valid, drive all 12 dropdowns backwards from it. On invalid, red border + inline message. This is the escape hatch for people who *do* have codes.

Under it, a hierarchy breadcrumb of the current selection and the `Remarks` text of the chosen entity row, if any (the catalog carries it — e.g. `"Reserved for Amplifier field Special Headquarters."` on `110000` in set 10 **[RAN]**).

### 3.4 Amplifiers tab

Two columns, mirroring where the text physically lands on the symbol. **Field → position mapping verified exactly** by rendering each option in isolation and reading the emitted `<text>` element **[RAN] `probe12.mjs`**:

| Field (milsymbol option) | Anchor x | Anchor y | `text-anchor` | Column |
|---|---|---|---|---|
| `quantity` | 100 | 40 | middle | top-centre |
| `engagementBar` | 100 | 11.5 | middle | above symbol |
| `specialHeadquarters` | 100 | 103 | middle | inside frame |
| `headquartersElement` | 100 | 185 | middle | below frame |
| `dtg` | 5 | 40 | end | left |
| `altitudeDepth` | 5 | 80 | end | left |
| `location` | 5 | 80 | end | left |
| `type` | 5 | 120 | end | left |
| `platformType` | 5 | 120 | end | left |
| `equipmentTeardownTime` | 5 | 120 | end | left |
| `uniqueDesignation` | 5 | 160 | end | left |
| `speed` | 5 | 200 | end | left |
| `reinforcedReduced` | 195 | 40 | start | right |
| `staffComments` | 195 | 80 | start | right |
| `additionalInformation` | 195 | 120 | start | right |
| `commonIdentifier` | 195 | 120 | start | right |
| `higherFormation` | 195 | 160 | start | right |
| `evaluationRating` | 195 | 200 | start | right |
| `combatEffectiveness` | 195 | 200 | start | right |
| `signatureEquipment` | 195 | 200 | start | right |
| `hostile` | 195 | 200 | start | right |
| `iffSif` | 195 | 200 | start | right |

Coordinates are in milsymbol's internal 0–200 space. **These are the positions when the field is the only one set; when several fields occupy the same slot milsymbol re-flows them** (e.g. with 10 fields set, rows land at y = 40/80/120/160/200 in each column **[RAN] `probe8.mjs`**). Therefore: **do not hard-code positions — parse them out of the emitted SVG** (§4.3).

Fields with **no visual output** in milsymbol 3.0.4, verified **[RAN]**: `sigint`, `country`, `auxiliaryEquipmentIndicator`, `installationComposition`, `guardedUnit`, `specialDesignator`. **Do not show these in the form** — an input that silently does nothing is worse than a missing input. If you must show them, show them disabled with tooltip `Not rendered by milsymbol 3.0.4`.

**Controls:**

- Each field is a single-line text input with the field name as a 10 px uppercase label and the APP-6E field letter as a badge (`T` for uniqueDesignation, `T1` for higherFormation, etc.).
- A single **`UPPERCASE` toggle** at the top of the tab, default **on**. Military amplifiers are conventionally uppercase; applied at render time only, so the underlying value survives toggling.
- `Amplifier text size` slider: maps to `infoSize`, range 20–60, default **40** (verified default **[RAN]**).
- `Show amplifiers` master switch → `infoFields`. When off, *all* text is suppressed and the symbol collapses to the bare frame: 63.2 × 54.2 vs 285.6 × 86.4 for the same symbol with 10 fields set **[RAN]**.
- **`Clear all`** button. Non-destructive: stores the cleared set for one undo within the session.

### 3.5 Style tab

| Control | Type | milsymbol option | Range / values | Default |
|---|---|---|---|---|
| Size | slider + number | `size` | 12 – 200 | **40** |
| Stroke width | slider | `strokeWidth` | 1 – 12 | **4** (verified default **[RAN]**) |
| Outline | slider | `outlineWidth` | 0 – 8 | **0** |
| Outline colour | colour swatch | `outlineColor` | any | `rgb(239,239,239)` |
| Padding | slider | `padding` | 0 – 40 | **0** |
| Square bounds | switch | `square` | bool | **off** |
| Draw frame | switch | `frame` | bool | **on** |
| Draw fill | switch | `fill` | bool | **on** |
| Draw icon | switch | `icon` | bool | **on** |
| Fill opacity | slider | `fillOpacity` | 0 – 1 | **1** |
| Colour mode | segmented | `colorMode` | `Light` / `Medium` / `Dark` | **Light** |
| Colour scheme | segmented | — | `Standard` / `Monochrome` / `Custom` | **Standard** |
| ↳ Mono colour | colour swatch | `monoColor` | any | `#000000` |
| ↳ Custom fill / icon / frame | 3 swatches | `fillColor`, `iconColor`, `frameColor` | any | — |
| Font | select | `fontfamily` + Figma font | from `figma.listAvailableFontsAsync()` | **Inter Regular** (not Arial — see §8.2) |

Verified colour-mode fills for a Friend land unit **[RAN] `probe4.mjs`**: `Light → rgb(128,224,255)`, `Medium → rgb(0,168,220)`, `Dark → rgb(0,107,140)`.

Verified standard fills at `colorMode: Light` **[RAN] `probe3.mjs` / `probe14.mjs`**:

| Affiliation | Fill |
|---|---|
| Friend / Assumed Friend | `rgb(128,224,255)` |
| Hostile | `rgb(255,128,128)` |
| Neutral | `rgb(170,255,170)` |
| Unknown / Pending | `rgb(255,255,128)` |
| **Suspect (E-edition, SI digit 5)** | `rgb(255, 229, 153)` — a *distinct* amber, not hostile red |
| Civilian | `rgb(255,161,255)` |

A `Reset to defaults` link at the bottom. A `Save as my default` button writes the whole style object to `clientStorage` key `defaults.style`.

### 3.6 Batch tab

Four collapsible sections, all collapsed except the first.

**1. Paste SIDCs**

```
┌────────────────────────────────────────────┐
│ 13031000141211000000, 1-7 IN               │
│ 13031000151211000000, A CO                 │
│ SFGPUCI----D,          legacy ok           │
└────────────────────────────────────────────┘
  ✓ 3 valid   ⚠ 0 invalid          [Insert 3 ▾]
```

- One per line. Optional `, label` suffix → becomes `uniqueDesignation`.
- Accepted formats, **all verified valid [RAN] `probe9.mjs` / `probe12.mjs`**: numeric 20-char, 22-char, 24-char, 30-char; letter 12-char and 15-char (2525C / APP-6B). 18-char numeric is **invalid** — reject with a clear message.
- Live validation gutter: green tick / red cross per line with the reason.
- Insert dropdown: `As a grid`, `As a component set`, `As a column`.

**2. Grid insert**

| Control | Default |
|---|---|
| Columns | 6 |
| Cell size | 96 px |
| Gap | 16 px |
| Label under each | `Name` / `SIDC` / `Both` / `None` → default `Name` |
| Source | `Pasted list` / `Current search results` / `Favourites` |

Cells are **fixed-size frames with the symbol centred**, because raw symbol bounds differ between sets by up to 34 % even with `square: true` **[RAN]**. Never rely on auto-layout hugging the symbol.

**3. Component set with affiliation variants**

- Checkbox list of affiliations to include (default: Friend, Hostile, Neutral, Unknown).
- `Property name` text field, default `Affiliation`.
- Output: one `ComponentSetNode` named `APP6E · <Entity name>`, containing one `ComponentNode` per affiliation named `Affiliation=Friend` etc. **[INF — the `Property=Value` component naming convention is standard Figma behaviour but `combineAsVariants`' docs do not state it; verify the property is derived rather than needing `componentPropertyDefinitions`.]** **[VERIFY]**
  *Fallback if variant properties are not derived from names:* create the set, then call `componentSet.editComponentProperty()` / `addComponentProperty()` explicitly.
- All variants are laid out on a single row, 16 px apart, each in an identically sized frame so the variant swap does not resize instances.

**4. ORBAT tree** *(COULD, behind a flag in v1)*

```
Textarea, tab- or 2-space-indented:
  2/3 ABCT
    1-7 IN
      A CO
      B CO
    3-8 CAV
```

| Control | Default |
|---|---|
| Root SIDC | current working SIDC |
| Echelon inference | `From indent depth` (depth 0 → Brigade `18`, 1 → Battalion `16`, 2 → Company `15`, 3 → Platoon `14`) / `Explicit` / `Off` |
| Layout | `Top-down` / `Left-right` |
| Connectors | on |
| Node spacing | 32 / 64 |

Each line's text becomes `uniqueDesignation`. A `# 13031000151211000000` suffix on a line overrides the SIDC for that node.

**5. Symbol sheet / legend**

- Source: `Selection` / `Current page` / `Pasted list`.
- Columns: `Symbol`, `Name`, `SIDC`, `Count` (checkboxes).
- Dedupe by SIDC, on by default.
- Output: an auto-layout table frame named `APP6E · Legend`.

### 3.7 Action bar (persistent)

```
┌──────────────────────────────────────────────────────┐
│ ┌──────┐  Infantry Platoon · Friend                  │
│ │  ▣   │  13031000141211000000              [Copy]   │
│ └──────┘                                             │
│                              [Insert ⏎]  [⌄]         │
└──────────────────────────────────────────────────────┘
```

- **Preview**: 88 × 88 box, symbol rendered at a size that fits with 8 px padding, on a checkerboard so `fill: false` is legible.
- **Title**: `<leaf entity name> <echelon> · <affiliation>`.
- **SIDC**: monospace 11 px, click to select-all.
- **`[Copy]`**: split button — `Copy SIDC` / `Copy SVG`. Both use a hidden `<textarea>` + `document.execCommand("copy")` in the iframe. **[INF: `navigator.clipboard.writeText` frequently fails inside the Figma plugin iframe for lack of transient activation / permissions-policy; `execCommand` is the reliable path.] [VERIFY]**
- **`[Insert ⏎]`**: primary. Enter anywhere in the panel triggers it, except while a multi-line textarea has focus.
- **`[⌄]`**: menu — `Insert into selection`, `Insert at viewport centre`, `Replace selection`, `Insert as component`.

**Insert target resolution:**

```ts
function resolveTarget(): { parent: BaseNode & ChildrenMixin; x: number; y: number } {
  const sel = figma.currentPage.selection;
  const first = sel[0];
  if (first && "appendChild" in first) {
    // a frame/group/component is selected → insert inside, at its centre
    return { parent: first as FrameNode, x: first.width / 2, y: first.height / 2 };
  }
  if (first) {
    // a leaf node is selected → insert as a sibling, to its right
    const p = first.parent as BaseNode & ChildrenMixin;
    return { parent: p, x: first.x + first.width + 16, y: first.y };
  }
  const c = figma.viewport.center;
  return { parent: figma.currentPage, x: c.x, y: c.y };
}
```

After insert: `figma.currentPage.selection = [node]`, **no** `scrollAndZoomIntoView` (it yanks the viewport and is the most-complained-about plugin behaviour), and `figma.notify("Inserted Infantry Platoon · Friend", {timeout: 1500})`.

---

## 4. Message protocol

Single discriminated union in each direction, shared in `src/shared/messages.ts`. Every message carries a `type` and, for anything that produces a result, a `nonce` for correlation.

### 4.1 Shared domain types

```ts
/** A 20-, 22-, 24- or 30-char numeric SIDC, or a 12/15-char legacy letter SIDC. */
export type Sidc = string;

export type Affiliation =
  | "Pending" | "Unknown" | "AssumedFriend" | "Friend"
  | "Neutral" | "Suspect" | "Hostile";

/** Digit 4 of a numeric SIDC. Limited to 0-6; 7/8/9 render frameless. */
export const AFFILIATION_DIGIT: Record<Affiliation, string> = {
  Pending: "0", Unknown: "1", AssumedFriend: "2", Friend: "3",
  Neutral: "4", Suspect: "5", Hostile: "6",
};

/** Exactly the subset of milsymbol SymbolOptions the plugin exposes. */
export interface StyleOptions {
  size: number;              // default 40
  strokeWidth: number;       // default 4
  outlineWidth: number;      // default 0
  outlineColor: string;      // default "rgb(239, 239, 239)"
  padding: number;           // default 0
  square: boolean;           // default false
  frame: boolean;            // default true
  fill: boolean;             // default true
  icon: boolean;             // default true
  fillOpacity: number;       // default 1
  colorMode: "Light" | "Medium" | "Dark";   // default "Light"
  scheme: "standard" | "mono" | "custom";   // default "standard"
  monoColor?: string;
  fillColor?: string;
  iconColor?: string;
  frameColor?: string;
  infoFields: boolean;       // default true
  infoSize: number;          // default 40
  fontFamily: string;        // Figma font family, default "Inter"
  fontStyle: string;         // default "Regular"
  uppercaseAmplifiers: boolean; // default true
  direction?: number;        // 0-359, omit to suppress the movement arrow
  speedLeader?: number;      // keep 0; see §8.6
}

/** Only the amplifiers milsymbol actually renders in 3.0.4. [RAN] */
export interface Amplifiers {
  quantity?: string;
  engagementBar?: string;
  specialHeadquarters?: string;
  headquartersElement?: string;
  dtg?: string;
  altitudeDepth?: string;
  location?: string;
  type?: string;
  platformType?: string;
  equipmentTeardownTime?: string;
  uniqueDesignation?: string;
  speed?: string;
  reinforcedReduced?: string;
  staffComments?: string;
  additionalInformation?: string;
  commonIdentifier?: string;
  higherFormation?: string;
  evaluationRating?: string;
  combatEffectiveness?: string;
  signatureEquipment?: string;
  hostile?: string;
  iffSif?: string;
}

/** The complete, serialisable description of one symbol. */
export interface SymbolSpec {
  sidc: Sidc;
  style: StyleOptions;
  amplifiers: Amplifiers;
  /** Human label used for node naming; derived, but cached so re-edit is offline-safe. */
  label: string;             // e.g. "Infantry Platoon"
  affiliation: Affiliation;  // derived from sidc digit 4, cached
}

/** One text amplifier, already resolved to Figma pixel space. See §4.3. */
export interface TextPlacement {
  characters: string;
  /** px, relative to the symbol group's top-left */
  x: number;
  y: number;
  fontSize: number;
  align: "LEFT" | "CENTER" | "RIGHT";
  color: string;             // css rgb() or #hex
}

/** Everything the sandbox needs to build a node, computed in the iframe. */
export interface RenderResult {
  /** SVG with every <text> element stripped. Safe for createNodeFromSvg. */
  svgNoText: string;
  /** The original SVG including <text>. Used only for "Copy SVG". */
  svgFull: string;
  width: number;             // px, = svg width attribute
  height: number;
  anchor: { x: number; y: number };   // milsymbol getAnchor(), px
  texts: TextPlacement[];
  valid: boolean;
  /** Present when valid === false. */
  problems?: string[];
}
```

### 4.2 UI → sandbox (`parent.postMessage({pluginMessage: msg}, "*")`)

```ts
export type UiToPlugin =
  | { type: "ui:ready" }

  | { type: "ui:resize"; width: number; height: number }

  /** Insert one symbol. */
  | { type: "insert:one";
      nonce: string;
      spec: SymbolSpec;
      render: RenderResult;
      target: "auto" | "viewport" | "selection" | "replace";
      asComponent: boolean }

  /** Insert N symbols as a fixed-cell grid. */
  | { type: "insert:grid";
      nonce: string;
      items: Array<{ spec: SymbolSpec; render: RenderResult }>;
      columns: number;       // 1..24
      cell: number;          // px, >= 32
      gap: number;           // px
      label: "none" | "name" | "sidc" | "both" }

  /** Build a ComponentSetNode with one variant per affiliation. */
  | { type: "insert:variantSet";
      nonce: string;
      base: SymbolSpec;
      propertyName: string;  // default "Affiliation"
      variants: Array<{ value: Affiliation; spec: SymbolSpec; render: RenderResult }> }

  /** Rebuild the contents of nodes that already carry our plugin data. */
  | { type: "update:nodes";
      nonce: string;
      updates: Array<{ nodeId: string; spec: SymbolSpec; render: RenderResult }> }

  /** Ask the sandbox which of the current selection are our symbols. */
  | { type: "selection:query"; nonce: string }

  /** Swap affiliation on the current selection without a full round trip of specs. */
  | { type: "selection:requestSpecs"; nonce: string }

  /** Symbol sheet / legend. */
  | { type: "insert:legend";
      nonce: string;
      rows: Array<{ spec: SymbolSpec; render: RenderResult; count: number }>;
      columns: Array<"symbol" | "name" | "sidc" | "count"> }

  /** ORBAT tree. */
  | { type: "insert:orbat";
      nonce: string;
      nodes: Array<{ id: string; parentId: string | null; spec: SymbolSpec; render: RenderResult }>;
      layout: "top-down" | "left-right";
      spacingX: number; spacingY: number; connectors: boolean }

  /** Persistence. */
  | { type: "storage:get"; nonce: string; key: StorageKey }
  | { type: "storage:set"; nonce: string; key: StorageKey; value: unknown }
  | { type: "storage:delete"; nonce: string; key: StorageKey }

  /** Fonts, for the Style tab font picker. */
  | { type: "fonts:list"; nonce: string }

  | { type: "notify"; message: string; error?: boolean }
  | { type: "close" };
```

### 4.3 Sandbox → UI (`figma.ui.postMessage(msg)`)

```ts
export type PluginToUi =
  /** Sent once after showUI, carries restored state so the UI never flashes defaults. */
  | { type: "init";
      theme: "light" | "dark";
      uiSize: { width: number; height: number };
      state: PersistedState;
      selection: SelectionSummary }

  | { type: "selection:changed"; selection: SelectionSummary }

  /** Generic ack for any nonce-carrying request. */
  | { type: "ack"; nonce: string; ok: true; nodeIds: string[] }
  | { type: "ack"; nonce: string; ok: false; error: string }

  | { type: "storage:value"; nonce: string; key: StorageKey; value: unknown }

  | { type: "fonts:list"; nonce: string;
      fonts: Array<{ family: string; styles: string[] }> }

  /** Quick-actions / relaunch entry point: open the panel pre-loaded. */
  | { type: "load:spec"; spec: SymbolSpec; nodeId?: string };

export interface SelectionSummary {
  count: number;
  /** Nodes that carry our plugin data, i.e. are editable symbols. */
  symbols: Array<{ nodeId: string; name: string; spec: SymbolSpec }>;
  /** True when at least one selected node can act as an insert parent. */
  hasContainer: boolean;
}
```

### 4.4 Where rendering happens, and why

**Decision: milsymbol runs in the iframe, not the sandbox.**

Both would work — `asSVG()` is verified to run with `typeof document === "undefined"` and `typeof window === "undefined"` **[RAN] `probe6.mjs`**. (`asDOM()` throws `ReferenceError: document is not defined`; the only `document.*` references in `src/` are in `symbolfunctions/icon.js` debug blocks and `ms/symbol/ascanvas.js` **[SRC]**.)

The iframe wins because:

1. The live preview needs the SVG in the iframe anyway. Rendering there avoids a round trip per keystroke.
2. The sandbox bundle stays small; the 861 KB `milsymbol.js` + 106 KB `milstandard-e` load in the iframe where a spinner is acceptable.
3. `RenderResult` is a flat, cheap, structured-clonable object.

The sandbox therefore never parses SVG or touches milsymbol. It receives `svgNoText` + `texts` and does pure Figma-API work.

**The `<text>` extraction the iframe performs** — verified against real output **[RAN] `probe8.mjs`, `probe12.mjs`, `probe13.mjs`**:

```ts
// Verified: the svg root always carries width, height and viewBox, and
// scale is exactly options.size / 100 for every symbol tested.
//   size 40  → width 63.2  viewBox "21 18.5 158 135.5"  → 63.2/158 = 0.4 = 40/100
//   size 100 → width 158   viewBox "21 18.5 158 135.5"  → 1.0
const TEXT_RE = /<text\b([^>]*)>([^<]*)<\/text>/g;
const ATTR = (a: string, n: string) => a.match(new RegExp(`\\b${n}="([^"]*)"`))?.[1];

/** Ascender / unitsPerEm. Arial hhea = 1854/2048; Inter = 1984/2048. [INF] */
const ASCENT_RATIO: Record<string, number> = { Arial: 0.905, Helvetica: 0.905, Inter: 0.96875 };

function extract(svg: string, size: number, fontFamily: string) {
  const [vx, vy, vw] = svg.match(/viewBox="([^"]+)"/)![1].split(/\s+/).map(Number);
  const w = Number(svg.match(/\bwidth="([^"]+)"/)![1]);
  const k = w / vw;                       // === size / 100
  const ratio = ASCENT_RATIO[fontFamily] ?? 0.9;
  const texts: TextPlacement[] = [];
  for (const m of svg.matchAll(TEXT_RE)) {
    const a = m[1];
    const fs = Number(ATTR(a, "font-size") ?? 40) * k;
    const anchor = ATTR(a, "text-anchor") ?? "start";
    texts.push({
      characters: m[2],
      x: (Number(ATTR(a, "x")) - vx) * k,      // baseline-relative; sandbox adjusts for align
      y: (Number(ATTR(a, "y")) - vy) * k - ratio * fs,   // baseline → box top
      fontSize: fs,
      align: anchor === "end" ? "RIGHT" : anchor === "middle" ? "CENTER" : "LEFT",
      color: ATTR(a, "fill") ?? "black",
    });
  }
  return { texts, svgNoText: svg.replace(TEXT_RE, ""), scale: k };
}
```

The sandbox then, per placement, after `textAutoResize = "WIDTH_AND_HEIGHT"`:

```ts
t.x = p.align === "LEFT" ? p.x : p.align === "CENTER" ? p.x - t.width / 2 : p.x - t.width;
t.y = p.y;
```

**[VERIFY]** the `ASCENT_RATIO` constants against a real Figma render once, and store the calibrated value. A 2–3 % baseline error is visible at large sizes.

---

## 5. Persistence

### 5.1 `figma.clientStorage` — per-user, per-plugin, 5 MB total **[DOC]**

Async only: `getAsync`, `setAsync`, `deleteAsync`, `keysAsync`. **Cleared when the user clears their browser cache** **[DOC]** — so nothing here may be load-bearing for document correctness.

```ts
export type StorageKey =
  | "schema"          // number, currently 1 — migrate on mismatch
  | "defaults.style"  // StyleOptions
  | "defaults.sidc"   // Sidc — last-used prefix (version/context/affiliation/set)
  | "recents"         // RecentEntry[]
  | "favourites"      // FavouriteEntry[]
  | "presets"         // Preset[]
  | "ui.size"         // { width, height }
  | "ui.activeTab"    // "browse" | "build" | "amplifiers" | "style" | "batch"
  | "ui.filters";     // { sets: string[]; hideDisused: boolean }

interface RecentEntry  { sidc: Sidc; label: string; at: number }      // cap 40, LRU
interface FavouriteEntry { sidc: Sidc; label: string; note?: string } // cap 200
interface Preset { id: string; name: string; style: StyleOptions; amplifiers: Amplifiers }
```

Budget: 40 recents + 200 favourites + 20 presets ≈ 40 KB. Nowhere near the 5 MB ceiling, but **cap the arrays anyway** — an uncapped recents list is how plugins end up with a 4 MB blob and a 900 ms cold start.

Write policy: debounce `storage:set` at **500 ms** and coalesce by key. Never write on every keystroke.

### 5.2 `node.setPluginData` — per-node, travels with the file, 100 kB per entry **[DOC]**

This is what makes re-edit work. Enforced since 2025-03-17; the entry size counts `pluginId + key + value` **[DOC]**.

**Two keys, deliberately:**

| Key | Value | Why separate |
|---|---|---|
| `app6e.spec` | `JSON.stringify(SymbolSpec)` — SIDC, style, amplifiers, label, affiliation | The full round-trip payload. ~700–1 500 bytes typical; a maximal amplifier set is still < 3 kB. |
| `app6e.v` | `"1"` | Schema version, read *first*, cheaply, when scanning a page. Lets `selection:query` and the legend generator filter without parsing every spec. |

**Read it back:**

```ts
function readSpec(node: SceneNode): SymbolSpec | null {
  if (node.getPluginData("app6e.v") !== "1") return null;
  try { return JSON.parse(node.getPluginData("app6e.spec")); } catch { return null; }
}
```

**Write it on:** the outer symbol frame only. Not on children — children get rebuilt.

**Do not use `setSharedPluginData`** in v1. Same 100 kB limit **[DOC]**, but it exposes the data to every other plugin and to the REST API, and there is no interop story yet. Revisit if an ORBAT-Mapper import/export bridge is built.

**Do not store the SVG.** It is 350–650 bytes for a bare symbol but grows fast, and it is fully reproducible from the spec. Storing it would double the file weight for zero benefit and would go stale when milsymbol updates.

### 5.3 Re-edit flow

1. User selects a symbol frame → `selectionchange` → sandbox sends `selection:changed` with parsed specs.
2. Panel shows `Editing: Infantry Platoon · Friend` in the action bar, `[Insert]` becomes `[Update]`.
3. Changes drive a new `RenderResult`; `update:nodes` replaces **the children only**:

```ts
async function applyUpdate(node: FrameNode, spec: SymbolSpec, r: RenderResult) {
  const oldName = node.name;
  for (const c of [...node.children]) c.remove();
  await buildInto(node, spec, r);          // recreates Icon + Amplifiers
  node.resize(r.width, r.height);
  node.name = nameFor(spec);
  node.setPluginData("app6e.spec", JSON.stringify(spec));
  node.setRelaunchData({ edit: `${spec.label} · ${spec.affiliation}` });
}
```

Node **id, position, parent, constraints, opacity, effects, rotation and any component-instance relationship are preserved** because the frame itself is never recreated. This is the single most important implementation rule in the plugin.

### 5.4 Affiliation swap in place

```ts
const AFF_DIGIT_INDEX = 3;  // 0-based; SIDC pos 4
function swapAffiliation(sidc: Sidc, to: Affiliation): Sidc {
  if (!/^\d{20,30}$/.test(sidc)) throw new Error("Affiliation swap needs a numeric SIDC");
  return sidc.slice(0, AFF_DIGIT_INDEX) + AFFILIATION_DIGIT[to] + sidc.slice(AFF_DIGIT_INDEX + 1);
}
```

Applies to every selected node that has `app6e.v === "1"`. Nodes without it are skipped with a count in the toast: `Recoloured 7 symbols · 2 selected nodes skipped`.

---

## 6. Node naming and layer structure

### 6.1 The tree

```
APP6E · Infantry Platoon · Friend              FrameNode        ← pluginData lives here
├── Icon                                       FrameNode        (clipsContent = false)
│   └── Symbol                                 FrameNode        ← from createNodeFromSvg
│       ├── Vector                                              (milsymbol's own paths)
│       ├── Vector
│       └── …
└── Amplifiers                                 FrameNode        (only when texts.length > 0)
    ├── T · 1-7 IN                             TextNode
    ├── T1 · 2/3 ABCT                          TextNode
    └── W · 091200ZJUN26                       TextNode
```

### 6.2 Naming rules

| Node | Pattern | Example |
|---|---|---|
| Root frame | `APP6E · {label} · {affiliation}` | `APP6E · Infantry Platoon · Friend` |
| Root, no echelon | `APP6E · {label} · {affiliation}` | `APP6E · Attack Helicopter · Hostile` |
| Root, with designation | `APP6E · {uniqueDesignation} · {label} · {affiliation}` | `APP6E · 1-7 IN · Infantry Battalion · Friend` |
| Icon group | `Icon` | |
| SVG import group | `Symbol` | |
| Amplifier group | `Amplifiers` | |
| Amplifier text | `{fieldLetter} · {value}` | `T · 1-7 IN` |
| Grid container | `APP6E · Grid ({n})` | `APP6E · Grid (24)` |
| Grid cell | `{label}` | `Infantry` |
| Component set | `APP6E · {label}` | `APP6E · Infantry Platoon` |
| Component variant | `{propertyName}={value}` | `Affiliation=Hostile` |
| Legend | `APP6E · Legend` | |
| ORBAT root | `APP6E · ORBAT · {rootLabel}` | `APP6E · ORBAT · 2/3 ABCT` |

`·` (U+00B7 MIDDLE DOT) is the separator throughout — it reads cleanly in the layers panel, is not used by the catalog labels (which use `/`), and does not collide with Figma's `=` and `,` variant syntax.

**`APP6E` prefix rationale:** a designer with 200 symbols on a page can type `APP6E` in the layers search and get exactly the plugin's output, and nothing else.

### 6.3 Structural rules

1. **The root is a `FrameNode`, never a `GroupNode`.** Groups resize to their children's bounds and cannot hold layout or constraints. Frames give a stable box for `Icon` + `Amplifiers` to live in, and survive the amplifier set changing.
2. **`clipsContent = false` on root and `Icon`.** The direction indicator and some amplifiers reach outside the nominal bounds.
3. **No auto-layout on the root.** Auto-layout would reposition the amplifiers, which must sit at standard-defined offsets. Auto-layout is used only for grid containers, legends and ORBAT rows.
4. **`constraints = {horizontal: "CENTER", vertical: "CENTER"}`** on `Icon`, so resizing the root scales sensibly. **[VERIFY]** with a quick manual resize.
5. **`Symbol` keeps milsymbol's own child structure untouched.** Do not rename or flatten the imported vectors — that is what lets a designer select just the frame or just the icon fill.
6. **`locked = false`, `expanded = false`** on `Icon` and `Amplifiers`, so the layers panel stays readable.
7. **Component variants are all the same box size.** Compute `max(width)` and `max(height)` across the variants first, then centre each symbol in that box. Otherwise swapping an instance from Friend to Hostile changes its size — the classic variant-set bug. Verified need: at `size: 40`, Friend land unit is 63.2 × 43.2 and Neutral is 47.2 × 47.2 **[RAN] `probe5.mjs`**.

---

## 7. Accessibility and ergonomics

### 7.1 Keyboard

| Key | Action |
|---|---|
| `⌘1`–`⌘5` | switch tab |
| `/` or `⌘F` | focus search (Browse tab), switching to Browse if needed |
| `↑ ↓` | move through the result list (list scrolls to keep focus visible) |
| `Enter` | insert the focused/current symbol |
| `⇧Enter` | insert into the current selection |
| `⌘Enter` | insert as a component |
| `Esc` | clear search → if already clear, `figma.closePlugin()` |
| `⌘C` in the action bar | copy SIDC |
| `Tab` | standard focus order: tab bar → search → list → action bar |

Every interactive element is a real `<button>`, `<input>`, `<select>` or `<a>` — no `div` with a click handler. The virtual list rows use `role="option"` inside `role="listbox"` with `aria-activedescendant` on the container, so the list is navigable without moving DOM focus per row.

Focus ring: `outline: 2px solid var(--figma-color-border-selected); outline-offset: 1px;` — never `outline: none`.

### 7.2 Theme

```css
:root {
  color-scheme: light dark;
}
body {
  background: var(--figma-color-bg);
  color: var(--figma-color-text);
  font: 11px/16px Inter, system-ui, sans-serif;
}
.secondary { color: var(--figma-color-text-secondary); }
.row:hover  { background: var(--figma-color-bg-hover); }
.row[aria-selected="true"] { background: var(--figma-color-bg-selected); }
input, select { background: var(--figma-color-bg-secondary); border: 1px solid var(--figma-color-border); color: var(--figma-color-text); }
.btn-primary { background: var(--figma-color-bg-brand); color: var(--figma-color-text-onbrand); }
.error { color: var(--figma-color-text-danger); }
```

With `themeColors: true`, Figma injects `<style id="figma-style">` and toggles a `figma-light` / `figma-dark` class on `<html>` **[DOC]**; 170+ `--figma-color-*` variables are available, including `-hover` and `-pressed` interaction states **[DOC]**.

**The preview is the one thing that must not follow the theme.** A Friend symbol is cyan-on-white by standard; showing it on a dark-theme background changes how it reads. Render the preview on a fixed light checkerboard in both themes, with a small `contrast` toggle for users mocking up a dark COP.

### 7.3 Performance with the full catalog

Measured, not guessed:

| Operation | Measured |
|---|---|
| `new ms.Symbol(sidc, {size:32}).asSVG()` × 500 | **7 ms** total (~0.014 ms each) **[RAN] `probe4.mjs`** |
| Fuzzy score over all 1 721 entity rows × 20 | **8 ms** total (~0.4 ms per pass) **[RAN] `probe7.mjs`** |
| Entity index as verbose JSON | 190 747 bytes (186.3 KB) **[RAN]** |
| Same index as `[set, code, label]` tuples | **108 291 bytes** **[RAN]** |
| Total selectable rows | **2 789** (1 721 entities + 785 mod-1 + 283 mod-2) **[RAN]** |
| Unique leaf entity labels | 1 374 **[RAN]** |

Conclusions, all follow from the numbers:

1. **No web worker is needed.** Search is sub-millisecond; a worker would add complexity and a message hop for nothing.
2. **Debounce search at 80 ms for render coalescing only**, not for compute.
3. **Virtualise the result list.** This is the only real cost: 1 721 rows × 56 px, each with an inline SVG preview of ~350–600 bytes, is roughly 1 MB of DOM. Render a window of `ceil(viewportHeight / 56) + 6` rows with a spacer div above and below. At 640 px panel height that is **~17 live rows**.
4. **Cache preview SVGs** in a `Map<string, string>` keyed by `sidc + size + affiliation + scheme`, capped at 500 entries, LRU. Rendering is cheap but string allocation in a scroll loop is not.
5. **Ship the compact tuple index**, not the verbose one — 108 KB vs 186 KB, and expand lazily.
6. **Lazy-load `milsymbol`** with a dynamic `import()` after first paint, so the panel's shell and search box appear immediately rather than after 861 KB parses. Show a 1-line skeleton in the preview box meanwhile.

### 7.4 Error and empty states

Every failure gets a specific message, never a silent no-op:

| Condition | Message |
|---|---|
| Entity not in this symbol set | `No icon for entity 9999 in Land unit. Pick a different entity.` |
| SI digit 7/8/9 | `Standard identity 7-9 is not defined in APP-6E — the symbol would render without a frame. Use 0-6.` |
| Legacy letter SIDC in a numeric-only operation | `Affiliation swap needs a numeric SIDC. Convert SFGPUCI----D first.` |
| 18-char numeric SIDC | `SIDC must be 20, 22, 24 or 30 digits. Got 18.` |
| Font not available | `Inter Regular isn't available in this file. Falling back to <first available>.` |
| Nothing selected on `Update` | `Select a symbol inserted by this plugin to edit it.` |

---

## 8. Anti-features and traps

### 8.1 Do not let Figma import the `<text>` elements — **critical**

milsymbol emits real `<text>` elements: 9 `font-family` attributes on a symbol with 10 amplifiers **[RAN] `probe1.mjs`**, `font-family="Arial"`, `font-size="40"`.

Figma's SVG import converts text into **individual per-letter vector shapes**, `letter-spacing` on `<tspan>` is ignored, and `<textPath>` never imports at all **[DOC — Figma forum]**. So the naive `figma.createNodeFromSvg(sym.asSVG())` produces:

- amplifiers that cannot be edited,
- one vector layer per letter (a 12-character DTG becomes 12 layers),
- text that will not restyle with the document's type styles,
- glyph shapes that depend on whatever font the renderer picked.

**The fix, non-negotiable:** strip `<text>` from the SVG before `createNodeFromSvg`, and recreate each one as a `TextNode` (§4.3). The regex `/<text\b([^>]*)>([^<]*)<\/text>/g` is sufficient — milsymbol emits no nested `<tspan>` and no attributes containing `>` **[RAN, verified across all 22 amplifier fields]**.

### 8.2 Font loading will bite you

- `figma.loadFontAsync({family, style})` **must be awaited before setting `characters` or `fontName`**, or the assignment throws. Load once per (family, style) and cache the promise.
- milsymbol's default `fontfamily` is `"Arial"` **[RAN]**. **Arial is not guaranteed in Figma on the web.** Default the plugin to **Inter Regular**, which ships with Figma.
- Offer a font picker driven by `figma.listAvailableFontsAsync()`, but call it **lazily** when the Style tab is first opened — it can return thousands of entries and is slow.
- Batch operations must load fonts **once up front**, not per node: `await Promise.all(uniqueFonts.map(figma.loadFontAsync))`.
- If the chosen font is missing, fall back and **say so in a toast**. Silently substituting is how briefing decks end up with mismatched typography.

### 8.3 `isValid()` is not enough

```
si=7 valid=true  aff=undefined  fillColor=undefined
si=8 valid=true  aff=undefined  fillColor=undefined
si=9 valid=true  aff=undefined  fillColor=undefined
```
**[RAN] `probe14.mjs`**

A symbol with standard-identity digit 7–9 passes `isValid()` and renders **with no frame and no fill** — the user gets a bare icon glyph and no error. Similarly, `new ms.Symbol("13031000141299990000").isValid()` is `false`, and `isValid(true)` returns `{icon: false, …}` **[RAN] `probe2.mjs`** — use the extended form to say *which* part failed.

**Gate on:**

```ts
function usable(sym: ms.Symbol): { ok: boolean; problems: string[] } {
  const problems: string[] = [];
  const ext = sym.isValid(true);
  const md = sym.getMetadata();
  if (ext === false) problems.push("SIDC not parseable");
  else if (typeof ext === "object") {
    if (!(ext as any).icon) problems.push("No icon for this entity in this symbol set");
    if (!(ext as any).drawInstructions) problems.push("No draw instructions");
  }
  if (md.affiliation === "undefined") problems.push("Standard identity must be 0-6");
  return { ok: problems.length === 0, problems };
}
```

### 8.4 Symbols do not all have the same bounds

At `size: 40`, **with `square: true` still applied** **[RAN] `probe5.mjs`**:

| Affiliation | w × h | | Symbol set | w × h |
|---|---|---|---|---|
| Friend / Assumed Friend | 63.2 × 63.2 | | 10 Land unit | 63.2 × 63.2 |
| Hostile / Suspect | 60.8 × 60.8 | | 20 Land installation | 63.2 × 63.2 |
| Unknown / Pending | 58.6 × 58.6 | | 01 Air | 59.2 × 59.2 |
| Neutral | 47.2 × 47.2 | | 15 Land equipment | 51.2 × 51.2 |
| Joker / Faker (7/8) | 43.2 × 43.2 | | 27 Dismounted | 47.2 × 47.2 |

Without `square`, Friend is 63.2 × **43.2** — a 1.46 aspect ratio, while Neutral is 1.0.

**Consequences:**
- Grid cells must be **fixed-size frames** with the symbol centred. Never hug.
- Component variants must be **normalised to a common box** (§6.3 rule 7).
- The `getAnchor()` point is the symbol's true centre-of-frame and **is not the bounding-box centre** unless `square: true`. For a Friend land unit at size 40 without `square`: bounds 63.2 × 54.2, anchor `{x: 31.6, y: 32.6}` **[RAN] `probe1.mjs`** — 2.5 px below the box centre. **Align on `getAnchor()`, not on bounds**, or a row of mixed-affiliation symbols will visibly wobble.

### 8.5 Do not lose edits on re-render

The temptation is `node.remove()` + insert a fresh node. That destroys the node id, so:

- component instances pointing at it break,
- prototype links break,
- comments anchored to it orphan,
- the layer's position in the z-order and in the layer tree is lost,
- any manual nudge, rotation, opacity or effect the designer applied is gone.

**Rule: mutate children, never replace the root.** See `applyUpdate()` in §5.3. Also:

- Preserve `node.x`, `node.y` explicitly when `resize()` changes bounds — Figma resizes from the top-left, so a symbol that grows when amplifiers are added will appear to drift. Re-anchor on the old anchor point:
  ```ts
  const oldAnchor = { x: node.x + prev.anchor.x, y: node.y + prev.anchor.y };
  node.resizeWithoutConstraints(r.width, r.height);
  node.x = oldAnchor.x - r.anchor.x;
  node.y = oldAnchor.y - r.anchor.y;
  ```
- Warn before overwriting a node whose `Icon` child count differs from what the plugin produced — that means the user hand-edited it. One toast, with an `Update anyway` action.

### 8.6 The direction indicator is a trap

**[RAN] `probe13.mjs` + [SRC] `src/symbolfunctions/directionarrow.js`**

| Options | Resulting size |
|---|---|
| no `direction` | 63.2 × 54.2 |
| `direction: 0` | 63.2 × **102.8** |
| `direction: 90` | **71.2** × 95.8 |
| `direction: 180` | 63.2 × **133.8** |
| `direction: 0, speedLeader: 1` | 63.2 × 54.2 — **arrow vanishes** |

Two behaviours share one option pair: `speedLeader === 0` draws the standard movement indicator (95 internal units, one frame height); `speedLeader > 0` switches to a *speed leader* line of length `speedLeader * (100 / size)` internal units **[SRC directionarrow.js:21, :108]** — which at `size: 40, speedLeader: 1` is 2.5 units, i.e. invisible.

Also: `direction` is ignored entirely unless `infoFields` is true **[SRC directionarrow.js:15]**.

**In the UI:** expose a single `Movement indicator` switch + a `Bearing` dial (0–359). Keep `speedLeader` at `0` and do not expose it in v1. If you later do, label it `Speed leader length` and note that it *replaces* the arrow.

And warn the user that turning it on **doubles the symbol's height** — which will break any grid they already laid out.

### 8.7 Other traps

| Trap | Avoidance |
|---|---|
| `stroke-dasharray` from feint/dummy and planned status **[RAN, confirmed present]** may not survive `createNodeFromSvg`. | **[VERIFY]** on a `hqtfd: 1` symbol. Fallback: after import, walk the imported vectors and set `dashPattern` from the parsed attribute. |
| `fill-opacity` is emitted **[RAN]**. Figma's importer may or may not map it to `opacity`. | **[VERIFY]**. Fallback: post-process fills. |
| Inserting scrolls the viewport. | Never call `scrollAndZoomIntoView` on insert. Offer it as an explicit `Zoom to` button. |
| Plugin reopens with default state, losing the user's last symbol. | Send `init` with restored state *before* the first paint; render a skeleton until it arrives. |
| 2 500-row `<select>` for entities. | Entity dropdowns are scoped to the symbol set — the largest is Control measures at 628, Land unit at 214 **[RAN]**. Still: use a searchable combobox, not a bare `<select>`, for any list over ~60 rows. |
| Disused/reserved entries pollute search (48 rows **[RAN]**). | Filtered out by default, with a toggle. |
| The plugin ID changes → all `setPluginData` becomes unreadable **[DOC]**. | Never change the plugin ID after first publish. Keep the `app6e.v` schema key so a future migration is possible. |
| `setRelaunchData` replaces all previous relaunch data **[DOC]**. | Always write the complete object. |
| Batch insert of 200 symbols blocks the UI thread. | Chunk the sandbox work: 20 nodes per `await new Promise(r => setTimeout(r, 0))`, and post progress back as `ack`-precursor `progress` messages. Show a determinate bar. |
| `figma.closePlugin()` before an async write completes. | Await all `clientStorage.setAsync` before closing. Never close from a `postMessage` handler without awaiting. |
| The SVG's `viewBox` has a non-zero origin (`"21 18.5 158 135.5"` **[RAN]**). | All coordinate maths must subtract `vx`/`vy`. Forgetting this offsets every amplifier by ~8 px at size 40. |

---

## 9. Appendix — verified reference data

### 9.1 Catalog inventory **[RAN] `catalog.mjs`**

| Symbol set | Name | Main icons | Mod 1 | Mod 2 |
|---|---|---|---|---|
| `01` | Air | 53 | 41 | 12 |
| `02` | Air missile | 1 | 9 | 16 |
| `05` | Space | 36 | 7 | 12 |
| `06` | Space Missile | 1 | 4 | 15 |
| `10` | Land unit | 214 | 99 | 89 |
| `11` | Land civilian unit/Organization | 11 | 26 | 2 |
| `15` | Land equipment | 206 | 27 | 10 |
| `20` | Land installations | 131 | 13 | 10 |
| `25` | Control measure | 628 | 51 | 5 |
| `27` | Dismounted individuals | 45 | 34 | 39 |
| `30` | Sea surface | 93 | 25 | 16 |
| `35` | Sea subsurface | 22 | 22 | 17 |
| `36` | Mine warfare | 65 | 0 | 0 |
| `40` | Activity/Event | 152 | 22 | 2 |
| `50` | Signals Intelligence – Space | 4 | 65 | 1 |
| `51` | Signals Intelligence – Air | 4 | 65 | 1 |
| `52` | Signals Intelligence – Land | 4 | 65 | 1 |
| `53` | Signals Intelligence – Surface | 4 | 65 | 1 |
| `54` | Signals Intelligence – Subsurface | 4 | 65 | 1 |
| `60` | Cyberspace | 43 | 13 | 7 |
| `common` | (shared modifiers) | 0 | 67 | 26 |
| | **TOTAL** | **1 721** | **785** | **283** |

All 1 721 main-icon rows carry a non-empty `Code` **[RAN]**.

Row shape (`mainIcon`): `{ Entity, "Entity Type", "Entity Subtype", Code, Remarks? }`.
Row shape (`modifier1` / `modifier2`): `{ "First Modifier" | "Second Modifier", Category, Code, Remarks? }`.

Import path that works in Node and in a bundler **[RAN]**:
```js
import { ms2525e } from "milstandard-e/milstandard.esm.js";
```

### 9.2 Numeric SIDC digit map (positions are 1-based) **[SRC `src/numbersidc/metadata.js` + RAN]**

| Pos | Field | Verified values |
|---|---|---|
| 1–2 | Version | `10`/`11`/`12` → edition **D**; `13`/`14` → edition **E** **[SRC:23-28]** |
| 3 | Context | `0` Reality, `1` Exercise, `2` Simulation **[RAN]** |
| 4 | Standard identity | `0` Pending, `1` Unknown, `2` Assumed Friend, `3` Friend, `4` Neutral, `5` Suspect (E: distinct amber fill), `6` Hostile. `7`/`8`/`9` = frameless, do not use **[RAN]** |
| 5–6 | Symbol set | see §9.1 |
| 7 | Status / condition | `0` Present, `1` Planned/Anticipated (dashed frame), `2` Fully capable, `3` Damaged, `4` Destroyed, `5` Full to capacity **[RAN]** |
| 8 | HQ / TF / Feint | `0` none, `1` feint (dashed), `2` HQ, `3` feint HQ, `4` TF, `5` feint TF, `6` TF+HQ, `7` feint TF+HQ **[RAN]** |
| 9–10 | Echelon **or** Mobility | echelon `11`–`26`; mobility `31`–`37`, `41`, `51`, `52`, `61`, `62` **[RAN]** |
| 11–16 | Entity / Type / Subtype | from the catalog `Code` column |
| 17–18 | Modifier 1 | |
| 19–20 | Modifier 2 | |
| 21–22 | *(optional)* | accepted, `functionid` unchanged **[RAN]** |
| 23 | *(optional)* frame shape | read as `sidc.substr(22,1)`, only honoured when edition is E **[SRC:11, :170]** |
| 24–30 | *(optional)* | 24- and 30-char codes accepted **[RAN]** |

Accepted lengths **[RAN]**: 20 ✓, 22 ✓, 24 ✓, 30 ✓, 18 ✗. Legacy letter SIDCs: 12-char ✓, 15-char ✓ (`getMetadata().numberSIDC === false`).

### 9.3 milsymbol default style **[RAN] `probe3.mjs`, `getStyle()`]**

```js
{
  alternateMedal: false, civilianColor: true, colorMode: "Light",
  fill: true, fillColor: "", fillOpacity: 1, fontfamily: "Arial",
  frame: true, frameColor: "", hqStaffLength: 0, icon: true, iconColor: "",
  infoBackground: "", infoBackgroundFrame: "", infoColor: "", infoFields: true,
  infoOutlineColor: "rgb(239, 239, 239)", infoOutlineWidth: false, infoSize: 40,
  monoColor: "", outlineColor: "rgb(239, 239, 239)", outlineWidth: 0,
  padding: 0, simpleStatusModifier: false, size: 100, square: false,
  standard: "", strokeWidth: 4, styleFill: false
}
```

`size` is the **frame height in output px** — a land-unit frame spans internal y = 50→150, i.e. 100 units, and `asSVG()` scale is exactly `size / 100` **[RAN]**.

`ms.setStandard("APP6")` and `ms.setStandard("2525")` both return `true`; anything else returns `false` **[RAN] `probe4.mjs`**. There is also a per-symbol `standard` option. For the SIDC tested it produced byte-identical output; it matters for sets where the two standards diverge (e.g. cyberspace, `src/numbersidc/sidc/cyberspace.js:157` branches on `!_STD2525 && edition == "E"` **[SRC]**). **Set it explicitly to `"APP6"`** — this is an APP-6E plugin.

### 9.4 Scratch scripts

All under `research/scratch/`:

| File | What it proves |
|---|---|
| `catalog.mjs` | §9.1 inventory |
| `probe1.mjs` | size/anchor/metadata, SVG head, amplifier font attrs |
| `probe2.mjs` | edition detection, validity, SVG element & attribute inventory |
| `probe3.mjs` | size scaling, `getOptions`/`getStyle`/`getColors` |
| `probe4.mjs` | every style option's effect, 500-render benchmark, `setStandard` |
| `probe5.mjs` | per-affiliation and per-set bounds, `square` |
| `probe6.mjs` | runs without DOM; `asDOM()` throws |
| `probe7.mjs` | index sizes, search benchmark, disused count |
| `probe8.mjs` | amplifier `<text>` geometry with 10 fields set |
| `probe9.mjs` | legacy SIDCs, SIDC lengths, echelon digits |
| `probe10.mjs` | status / HQTFD / context / mobility digits |
| `probe11.mjs` | feint-dummy and planned dash rendering |
| `probe12.mjs` | 30-char SIDC, per-field amplifier positions |
| `probe13.mjs` | direction indicator bounds, speedLeader quirk |
| `probe14.mjs` | standard-identity digits 0–9, affiliation fills |

### 9.5 Open items to verify in a live Figma session

1. `figma.combineAsVariants` — whether `Property=Value` component names are auto-derived into variant properties.
2. Whether `createNodeFromSvg` preserves `stroke-dasharray` as `dashPattern`.
3. Whether `createNodeFromSvg` maps `fill-opacity` to node opacity or fill opacity.
4. The exact ascender ratio for the chosen default font, to calibrate `ASCENT_RATIO` in §4.3.
5. Whether `navigator.clipboard.writeText` works in the plugin iframe, or `document.execCommand("copy")` is required.
6. `constraints = {horizontal: "CENTER", vertical: "CENTER"}` behaviour on the `Icon` frame under root resize.
