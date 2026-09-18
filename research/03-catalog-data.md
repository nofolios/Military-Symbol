# 03 — Building a complete, searchable APP-6E entity catalog from `milstandard-e`

**Status:** every number in this document was produced by reading or running the local
packages on 2026-09-17. Nothing is quoted from memory. Claims I could not verify locally
are explicitly marked **[UNVERIFIED]**.

| item | value |
|---|---|
| `milstandard-e` | **0.2.14** — MIT — `node_modules/milstandard-e` |
| `milsymbol` | **3.0.4** — MIT — `node_modules/milsymbol` |
| `mil-std-2525` (D edition) | **NOT INSTALLED.** `node_modules` contains only `@esbuild`, `@figma`, `esbuild`, `milstandard-e`, `milsymbol`, `preact`, `typescript`. The D-edition comparison in the brief could not be done. |
| scripts written | `research/scratch/inventory.mjs`, `research/scratch/parse-catalog.mjs`, `research/scratch/coverage.mjs`, `research/scratch/compact.mjs`, `research/scratch/probe1.mjs`–`probe4.mjs` |
| artefacts written | `research/coverage.json` (384 KB), `research/scratch/catalog.json` (914 KB), `research/scratch/catalog.compact.json` (105 KB) |

**Headline numbers**

* **1 705** unique entity rows across **16** distinct entity TSVs; **1 721** (set, code) pairs once the
  single SIGINT table is attributed to all five SIGINT symbol sets.
* **20** symbol sets are defined by `milstandard-e` (`01 02 05 06 10 11 15 20 25 27 30 35 36 40 50 51 52 53 54 60`) plus a `common` pseudo-set.
* **0** parse failures, **0** duplicate codes, **0** malformed codes, **0** hierarchy/code-level mismatches.
* milsymbol 3.0.4 in APP-6 mode draws real icon geometry for **1 326 / 1 721** entities.
  **395** draw nothing beyond the frame — and **364** of those (all in symbol set 25) additionally
  draw milsymbol's *"unknown icon"* question-mark glyph, which the plugin must suppress.
* Outside symbol set 25 the coverage is **1 062 / 1 093 (97.2 %)**, and every single miss is
  a parent/category node or a `{Disused}` placeholder — **no selectable leaf entity is missing
  an icon.** The only real gaps are **292 leaf Control Measures** that are lines, areas, axes
  or corridors, which milsymbol does not model at all.

---

## 1. Inventory of `node_modules/milstandard-e/tsv-tables/`

### 1.1 File-format facts (verified byte-wise with `od -c` and a Node scan)

* **48 files**, all `.tsv`.
* Encoding **UTF-8, no BOM**. The only non-ASCII code points anywhere in the corpus are
  `U+2013` EN DASH, `U+2018` and `U+2019` curly quotes. (`Civil–Military Cooperation`,
  `Mine–Like`, `Re–Entry`, `‘…’` in `Common Modifiers sector 1.tsv`.)
* Line terminator is **CRLF everywhere**. Zero lone `\r`, zero lone `\n`.
* **No file has a trailing newline except `Air missile.tsv`.** The last data row of every
  other file ends at EOF with no terminator.
* **No quoting at all.** The character `"` does not occur in any of the 48 files. A plain
  `split("\t")` is therefore safe — you do **not** need an RFC-4180 CSV parser.
* **Rows are ragged**: trailing empty cells are simply absent, so a 5-column table yields
  4-cell rows whenever `Remarks` is empty. See the `ragged col counts` column below.
* **`Control Measures.tsv` has a trailing tab on its header line**, producing a 7th,
  empty-named column. `milstandard-e`'s own parser faithfully creates a `""` key on every
  control-measure row because of it (verified: `Object.keys(ms2525e["25"].mainIcon[0])` ⇒
  `["Entity","Entity Type","Entity Subtype","Geometric Rendering","Code","Remarks",""]`).
* **Trailing whitespace inside cells is real.** e.g. `Land unit.tsv` code `110200` is
  `"Civil Affairs "`; `Control Measures sector 1.tsv` codes `01`–`04` all end with a space.
  `milstandard-e` does **not** trim; you must.

### 1.2 The inventory

| TSV file | data rows | header (tab-separated) | trailing NL | ragged col counts |
|---|---|---|---|---|
| `Activities sector 1.tsv` | 22 | First Modifier · Category · Code · Remarks | no | {"3":22} |
| `Activities sector 2.tsv` | 2 | Second Modifier · Category · Code · Remarks | no | {"3":2} |
| `Activities.tsv` | 152 | Entity · Entity Type · Entity Subtype · Code · Remarks | no | {"4":142,"5":10} |
| `Air missile sector 1.tsv` | 9 | First Modifier · Category · Code · Remarks | no | {"3":9} |
| `Air missile sector 2.tsv` | 16 | Second Modifier · Category · Code · Remarks | no | {"3":6,"4":10} |
| `Air missile.tsv` | 1 | Entity · Entity Type · Entity Subtype · Code · Remarks | **yes** | {"4":1} |
| `Air sector 1.tsv` | 41 | First Modifier · Category · Code · Remarks | no | {"3":41} |
| `Air sector 2.tsv` | 12 | Second Modifier · Category · Code · Remarks | no | {"3":9,"4":3} |
| `Air.tsv` | 53 | Entity · Entity Type · Entity Subtype · Code · Remarks | no | {"4":50,"5":3} |
| `Common Modifiers sector 1.tsv` | 67 | First Modifier · Category · Code · Remarks | no | {"3":65,"4":2} |
| `Common Modifiers sector 2.tsv` | 26 | Second Modifier · Category · Code · Remarks | no | {"3":26} |
| `Control Measures sector 1.tsv` | 51 | First Modifier · **Capability** · Code · Remarks | no | {"3":51} |
| `Control Measures sector 2.tsv` | 5 | Second Modifier · Category · Code · Remarks | no | {"3":5} |
| `Control Measures.tsv` | 628 | Entity · Entity Type · Entity Subtype · **Geometric Rendering** · Code · Remarks · **(empty)** | no | {"5":569,"6":59} |
| `Cyberspace sector 1.tsv` | 13 | First Modifier · **Capability** · Code · Remarks | no | {"3":13} |
| `Cyberspace sector 2.tsv` | 7 | Second Modifier · Category · Code · Remarks | no | {"3":7} |
| `Cyberspace.tsv` | 43 | Entity · Entity Type · Entity Subtype · Code · Remarks | no | {"4":38,"5":5} |
| `Dismounted individual sector 1.tsv` | 34 | First Modifier · Category · Code · Remarks | no | {"3":34} |
| `Dismounted individual sector 2.tsv` | 39 | Second Modifier · Category · Code · Remarks | no | {"3":39} |
| `Dismounted individual.tsv` | 45 | Entity · Entity Type · Entity Subtype · Code · Remarks | no | {"4":41,"5":4} |
| `Land civilian sector 1.tsv` | 26 | First Modifier · **Capability** · Code · Remarks | no | {"3":26} |
| `Land civilian sector 2.tsv` | 2 | Second Modifier · Category · Code · Remarks | no | {"3":2} |
| `Land civilian.tsv` | 11 | Entity · Entity Type · Entity Subtype · Code · Remarks | no | {"4":10,"5":1} |
| `Land equipment sector 1.tsv` | 27 | First Modifier · Category · Code · Remarks | no | {"3":27} |
| `Land equipment sector 2.tsv` | 10 | Second Modifier · Category · Code · Remarks | no | {"3":10} |
| `Land equipment.tsv` | 206 | Entity · Entity Type · Entity Subtype · Code · Remarks | no | {"4":197,"5":9} |
| `Land installation sector 1.tsv` | 13 | First Modifier · Category · Code · Remarks | no | {"3":9,"4":4} |
| `Land installation sector 2.tsv` | 10 | Second Modifier · Category · Code · Remarks | no | {"3":10} |
| `Land installation.tsv` | 131 | Entity · Entity Type · Entity Subtype · Code · Remarks | no | {"4":127,"5":4} |
| `Land unit sector 1.tsv` | 99 | First Modifier · Category · Code · Remarks | no | {"3":99} |
| `Land unit sector 2.tsv` | 89 | Second Modifier · Category · Code · Remarks | no | {"3":89} |
| `Land unit.tsv` | 214 | Entity · Entity Type · Entity Subtype · Code · Remarks | no | {"4":207,"5":7} |
| `Mine warfare.tsv` | 65 | Entity · Entity Type · Entity Subtype · Code · Remarks | no | {"4":59,"5":6} |
| `Sea subsurface sector 1.tsv` | 22 | First Modifier · Category · Code · Remarks | no | {"3":14,"4":8} |
| `Sea subsurface sector 2.tsv` | 17 | Second Modifier · Category · Code · Remarks | no | {"3":4,"4":13} |
| `Sea subsurface.tsv` | 22 | Entity · Entity Type · Entity Subtype · Code · Remarks | no | {"4":19,"5":3} |
| `Sea surface sector 1.tsv` | 25 | First Modifier · Category · Code · Remarks | no | {"3":22,"4":3} |
| `Sea surface sector 2.tsv` | 16 | Second Modifier · Category · Code · Remarks | no | {"3":16} |
| `Sea surface.tsv` | 93 | Entity · Entity Type · Entity Subtype · Code · Remarks | no | {"4":89,"5":4} |
| `Signals intelligence sector 1.tsv` | 65 | First Modifier · Category · Code · Remarks | no | {"3":64,"4":1} |
| `Signals intelligence sector 2.tsv` | 1 | Second Modifier · Category · Code · Remarks | no | {"3":1} |
| `Signals intelligence.tsv` | **4** | Entity · Entity Type · Entity Subtype · Code · Remarks | no | {"4":3,"5":1} |
| `Space missile sector 1.tsv` | 4 | First Modifier · Category · Code · Remarks | no | {"3":4} |
| `Space missile sector 2.tsv` | 15 | Second Modifier · Category · Code · Remarks | no | {"3":4,"4":11} |
| `Space missile.tsv` | 1 | Entity · Entity Type · Entity Subtype · Code · Remarks | no | {"4":1} |
| `Space sector 1.tsv` | 7 | First Modifier · Category · Code · Remarks | no | {"3":7} |
| `Space sector 2.tsv` | 12 | Second Modifier · Category · Code · Remarks | no | {"3":4,"4":8} |
| `Space.tsv` | 36 | Entity · Entity Type · Entity Subtype · Code · Remarks | no | {"4":35,"5":1} |

Only **two** column layouts exist:

```
Entity \t Entity Type \t Entity Subtype \t Code \t Remarks                              (15 entity tables)
Entity \t Entity Type \t Entity Subtype \t Geometric Rendering \t Code \t Remarks \t    (Control Measures.tsv only)
First|Second Modifier \t Category|Capability \t Code \t Remarks                         (all 32 modifier tables)
```

### 1.3 Sample rows (first three data rows, tab-split, verbatim after CR stripping)

```
Activities.tsv            ["Incident","","","110000","Reserved for hierarchical purposes."]
                          ["","Criminal Activity Incident","","110100"]
                          ["","","Arrest/Apprehend/Detain","110101"]
Air.tsv                   ["Military","","","110000","Reserved for hierarchical purposes."]
                          ["","Fixed Wing","","110100"]
                          ["","","Medical Evacuation (MEDEVAC)","110101"]
Control Measures.tsv      ["Command and Control Lines","","","","110000","Reserved for hierarchical purposes."]
                          ["","Boundary","","Line","110100"]
                          ["","Light Line","","Line","110200"]
Land unit.tsv             ["Command and Control","","","110000","Reserved for Amplifier field Special Headquarters."]
                          ["","Broadcast Transmitter Antennae","","110100"]
                          ["","Civil Affairs ","","110200"]              <-- trailing space
Sea surface.tsv           ["Military","","","110000","Reserved for hierarchical purposes."]
                          ["Military Combatant","","","120000","Reserved for hierarchical purposes."]
                          ["","Carrier","","120100"]
Signals intelligence.tsv  ["Signal Intercept","Signal Intercept","","110000","Reserved for hierarchical purposes."]
                          ["","Communications","","110100"]
                          ["","Jammer","","110200"]                      <-- whole file is 4 rows
Mine warfare.tsv          ["Sea Mine, General","","","110000"]
                          ["","Sea Mine, Bottom","","110100"]
                          ["","Sea Mine, Moored","","110200"]
Common Modifiers sector 1.tsv
  ["Unmanned Aircraft (UA)/ Unmanned Aerial Vehicle (UAV)/ Unmanned Aircraft System (UAS)/ Remote Piloted Vehicle (RPV)","Mobility","100"]
  ["Robotic","Mobility","101"]
  ["Fixed Wing","Mobility","102","Not used by USAF"]                     <-- 3-digit code
Land unit sector 1.tsv    ["Tactical Satellite Communications","Communications","01"]
                          ["Area","Mission area","02"]
                          ["{Disused}","","03"]                          <-- 2-digit code
```

---

## 2. `src/2525e.js` and `src/tsv2json.js` — intended JSON shape and file→symbol-set mapping

### 2.1 How the package is built

`rollup.config.mjs` uses `rollup-plugin-string` with `include: "**/*.tsv"`, so every
`import x from "./../tsv-tables/Foo.tsv"` inlines the **raw file text as a JS string
literal** into `milstandard.js` / `milstandard.esm.js`. `src/2525e.js` then calls
`tsv2json()` on each string at module-evaluation time. There is no build-time JSON; the
whole corpus is re-parsed on every import.

### 2.2 `tsv2json.js` verbatim behaviour (read, then reproduced)

```js
export default function csv2json(str) {
  var e, et;
  str = str.replace(/\r/g, "");        // 1. kill all CR (so CRLF -> LF)
  var arr = str.split("\n");
  var header = arr[0].split("\t");     // 2. header split, NOT trimmed, trailing "" kept
  ...
    if (arr[i] == "") { arr.splice(i,1); i--; continue; }   // 3. drop blank lines
    var values = arr[i].split("\t");
    for (var j = 0; j < header.length; j++) {
      if (j <= values.length) arr[i][header[j]] = values[j];   // 4. off-by-one, see below
      ...
      if (arr[i]["Entity"])        { e = arr[i]["Entity"]; et = ""; }
      if (arr[i]["Entity Type"])   { arr[i]["Entity"] = e;  et = arr[i]["Entity Type"]; }
      if (arr[i]["Entity Subtype"]){ arr[i]["Entity"] = e;  arr[i]["Entity Type"] = et; }
    }
  arr.shift();                        // 5. drop the header row
  return arr;                         //    -> array of plain objects
}
```

Things a re-implementation must know:

1. **`j <= values.length` is an off-by-one.** For a 4-cell row against a 5-name header it
   assigns `row["Remarks"] = values[4] = undefined`. `JSON.stringify` then drops the key,
   which is why `ms2525e["10"].mainIcon[1]` has no `Remarks` key at all. Harmless, but
   don't rely on the key existing.
2. **The forward-fill block runs inside the `j` loop**, so it executes `header.length`
   times per row on a progressively-populated object. It happens to be self-correcting
   (the `Entity` branch resets `et = ""`, and the very next `Entity Type` branch restores
   it from the value just written), but it is fragile. Re-implement it as a single pass
   over the row, not inside the column loop.
3. **Nothing is trimmed.** `"Civil Affairs "` survives with its trailing space.
4. **Empty header names become real keys.** `Control Measures.tsv` rows all carry a `""` key.
5. **`str.replace(/\r/g,"")` before splitting on `\n` means a CR-only file would collapse
   to one line.** The corpus is all CRLF so this never fires, but a future data drop could
   break it.

### 2.3 The exported object shape

`import { ms2525e } from "milstandard-e"` (or `"milstandard-e/milstandard.esm.js"`) gives:

```ts
type MS2525E = Record<SymbolSetKey, {
  symbolset: string;                    // "10", "25", …; "" for the `common` pseudo-entry
  name: string;                         // human name, see the definitive table below
  mainIcon: EntityRow[];                // [] for `common`
  modifier1: ModifierRow[];             // [] for symbol set 36
  modifier2: ModifierRow[];             // [] for symbol set 36
}>;

type EntityRow = {
  "Entity": string;                     // forward-filled level-1 label
  "Entity Type": string;                // forward-filled level-2 label, "" at level 1
  "Entity Subtype": string;             // "" unless the row is level 3
  "Geometric Rendering"?: string;       // symbol set 25 only: Point|Line|Area|Axis|Corridor|""
  "Code": string;                       // 6 digits, always present
  "Remarks"?: string;                   // key absent when the source cell was absent
  ""?: string;                          // symbol set 25 only, artefact of the header's trailing tab
};

type ModifierRow = {
  "First Modifier" | "Second Modifier": string;
  "Category" | "Capability": string;    // the header name varies by file, see §4
  "Code": string;                       // 2 digits per-symbol-set, 3 digits for `common`
  "Remarks"?: string;
};
```

Key order of `Object.keys(ms2525e)` (verified by running it):
`["10","11","15","20","25","27","30","35","36","40","50","51","52","53","54","60","common","01","02","05","06"]`
— i.e. **not sorted**, and `common` sits in the middle. Do not iterate assuming order.

### 2.4 THE DEFINITIVE TABLE — TSV filename → symbol set code → human name

Transcribed directly from `src/2525e.js` and re-verified at runtime against
`ms2525e[set].mainIcon.length` / `.modifier1.length` / `.modifier2.length`.

| TSV entity file | set | `milstandard-e` `name` | recommended display name | sector-1 file | sector-2 file | entities | m1 | m2 |
|---|---|---|---|---|---|---|---|---|
| `Air.tsv` | **01** | `Air` | Air | `Air sector 1.tsv` | `Air sector 2.tsv` | 53 | 41 | 12 |
| `Air missile.tsv` | **02** | `Air missile` | Air Missile | `Air missile sector 1.tsv` | `Air missile sector 2.tsv` | 1 | 9 | 16 |
| `Space.tsv` | **05** | `Space` | Space | `Space sector 1.tsv` | `Space sector 2.tsv` | 36 | 7 | 12 |
| `Space missile.tsv` | **06** | `Space Missile` | Space Missile | `Space missile sector 1.tsv` | `Space missile sector 2.tsv` | 1 | 4 | 15 |
| `Land unit.tsv` | **10** | `Land unit` | Land Unit | `Land unit sector 1.tsv` | `Land unit sector 2.tsv` | 214 | 99 | 89 |
| `Land civilian.tsv` | **11** | `Land civilian unit/Organization` | Land Civilian Unit / Organization | `Land civilian sector 1.tsv` | `Land civilian sector 2.tsv` | 11 | 26 | 2 |
| `Land equipment.tsv` | **15** | `Land equipment` | Land Equipment | `Land equipment sector 1.tsv` | `Land equipment sector 2.tsv` | 206 | 27 | 10 |
| `Land installation.tsv` | **20** | `Land installations` | Land Installation | `Land installation sector 1.tsv` | `Land installation sector 2.tsv` | 131 | 13 | 10 |
| `Control Measures.tsv` | **25** | `Control measure` | Control Measure | `Control Measures sector 1.tsv` | `Control Measures sector 2.tsv` | 628 | 51 | 5 |
| `Dismounted individual.tsv` | **27** | `Dismounted individuals` | Dismounted Individual | `Dismounted individual sector 1.tsv` | `Dismounted individual sector 2.tsv` | 45 | 34 | 39 |
| `Sea surface.tsv` | **30** | `Sea surface` | Sea Surface | `Sea surface sector 1.tsv` | `Sea surface sector 2.tsv` | 93 | 25 | 16 |
| `Sea subsurface.tsv` | **35** | `Sea subsurface` | Sea Subsurface | `Sea subsurface sector 1.tsv` | `Sea subsurface sector 2.tsv` | 22 | 22 | 17 |
| `Mine warfare.tsv` | **36** | `Mine warfare` | Mine Warfare | **none** (`tsv2json("")`) | **none** | 65 | **0** | **0** |
| `Activities.tsv` | **40** | `Activity/Event` | Activity / Event | `Activities sector 1.tsv` | `Activities sector 2.tsv` | 152 | 22 | 2 |
| `Signals intelligence.tsv` | **50** | `Signals Intelligence – Space` | SIGINT – Space | `Signals intelligence sector 1.tsv` | `Signals intelligence sector 2.tsv` | 4 | 65 | 1 |
| `Signals intelligence.tsv` | **51** | `Signals Intelligence – Air` | SIGINT – Air | *(same file)* | *(same file)* | 4 | 65 | 1 |
| `Signals intelligence.tsv` | **52** | `Signals Intelligence – Land` | SIGINT – Land | *(same file)* | *(same file)* | 4 | 65 | 1 |
| `Signals intelligence.tsv` | **53** | `Signals Intelligence – Surface` | SIGINT – Surface | *(same file)* | *(same file)* | 4 | 65 | 1 |
| `Signals intelligence.tsv` | **54** | `Signals Intelligence – Subsurface` | SIGINT – Subsurface | *(same file)* | *(same file)* | 4 | 65 | 1 |
| `Cyberspace.tsv` | **60** | `Cyberspace` | Cyberspace | `Cyberspace sector 1.tsv` | `Cyberspace sector 2.tsv` | 43 | 13 | 7 |
| — | `common` | `""` | *(pseudo-set: 3-digit common modifiers)* | `Common Modifiers sector 1.tsv` | `Common Modifiers sector 2.tsv` | 0 | 67 | 26 |

Note the en-dash `–` (U+2013) inside the five SIGINT `name` strings — matching on a
hyphen-minus will fail.

**`milstandard-e` has no data for symbol sets `00` (Unknown) or `12`.** milsymbol's
`src/numbersidc/metadata.js` `dimensionMapping` does list `12: "Ground"` and `39: "Subsurface"`,
and `symbolSet == "12"` appears in its civilian test, but no icon table or TSV exists for
either. Treat 00 / 12 / 39 as out of scope. **[UNVERIFIED against the published APP-6E.]**

### 2.5 Signals Intelligence — how the sub-sets are encoded

The brief says SIGINT "spans symbol sets 50–55". **It spans 50–54 in both local packages:**

* `src/2525e.js` defines exactly `50, 51, 52, 53, 54` (Space / Air / Land / Surface / Subsurface).
* `src/numbersidc/sidc/signalsintelligence.js` gates its whole icon table on
  `symbolSet == "50" || "51" || "52" || "53" || "54"`.
* There is no `55` anywhere in either package. **No evidence of a symbol set 55. [UNVERIFIED —
  I did not read APP-6E itself.]**

**The environment *is* the sub-set.** All five symbol sets share one 4-row entity table:

| code | level | label | milsymbol icon |
|---|---|---|---|
| `110000` | 1 | Signal Intercept | *(none — frame only)* |
| `110100` | 2 | Signal Intercept > Communications | `SI.IC.COMMUNICATIONS` |
| `110200` | 2 | Signal Intercept > Jammer | `SI.I.JAMMER / ELECTRONIC COUNTER-MEASURES` |
| `110300` | 2 | Signal Intercept > Radar | `SI.IC.RADAR` |

All discrimination lives in **sector-1**, a 65-row table (`Signals intelligence sector 1.tsv`)
whose `Category` column is the real taxonomy: `Radar`, `Communications`, `Jammer`, `Sensor Type`…
e.g. `01 Anti-Aircraft Fire Control / Radar`, `11 Cellular/Mobile / Communications`,
`25 Barrage Jammer / Jammer`. The **frame shape** comes from the symbol set: milsymbol maps
`50 → Air (space)`, `51 → Air`, `52 → Sea-shaped Ground` (`metadata.dimension = "Sea"` for
symbol set 52, same special-case as land equipment 15), `53 → Sea`, `54 → Subsurface`.

Practical consequence for the plugin: **do not present 4 SIGINT entities × 5 sets = 20 rows.**
Present the 65 sector-1 modifiers as the searchable leaves, crossed with the 5 environments.

### 2.6 Control Measures (25) — how the sub-sets are encoded

There is no separate sub-set field. Symbol set 25's structure is carried by **the first two
digits of the 6-digit entity code**, which encode *(functional area × geometry class)*, and by
the extra **`Geometric Rendering`** column, which gives the per-row primitive.

The 24 level-1 groups (all `EE0000`), verified from `research/scratch/catalog.json`:

| code | group | geometry classes present in its children |
|---|---|---|
| `110000` | Command and Control Lines | Line ×5 |
| `120000` | Command and Control Areas | Area ×8 |
| `130000` | Command and Control Points | Point ×26 |
| `140000` | Maneuver Lines | Line ×23 |
| `150000` | Maneuver Areas | Area ×30, **Axis ×5** |
| `160000` | Maneuver Points | Point ×8 |
| `170000` | Airspace Control (Corridors) Areas | **Corridor ×7**, Area ×13 |
| `180000` | Airspace Control Points | Point ×26 |
| `190000` | Airspace Control Lines | Line ×2 |
| `200000` | Maritime Control Areas | Area ×11 |
| `210000` | Maritime Control Points | Point ×109, Line ×1 |
| `220000` | Maritime Control Lines | Line ×9 |
| `230000` | Deception | *(no geometry cell)* |
| `240000` | Fires Areas | Area ×58, Point ×4, Line ×3 |
| `250000` | Fires Points | Point ×6 |
| `260000` | Fire Lines | Line ×6 |
| `270000` | Protection Areas | Area ×20, Line ×12 |
| `280000` | Protection Points | Point ×35, Line ×2 |
| `290000` | Protection Lines | Line ×21 |
| `300000` | Intelligence Lines | Line ×1 |
| `310000` | Sustainment Areas | Area ×8 |
| `320000` | Sustainment Points | Point ×38 |
| `330000` | Sustainment Lines | Line ×10 |
| `340000` | Mission Tasks | Area ×47, Point ×2 |

Corpus-wide `Geometric Rendering` distribution across the 628 rows:
`Point 254 · Area 195 · Line 95 · Corridor 7 · Axis 5 · "" 72`.
The 72 empty cells are the 24 group rows plus 48 level-2 rows that are themselves parents.

**This column is the single most important field in the whole catalog for a Figma plugin**,
because milsymbol can only render the `Point` family as a single symbol (see §5).

---

## 3. Entity-table parsing specification + runnable parser

### 3.1 The algorithm

```
INPUT:  raw file bytes
1.  decode UTF-8; strip a leading U+FEFF if one ever appears (none today)
2.  split on /\r\n|\r|\n/   (tolerates all three, today it is always CRLF)
3.  header  = lines[0].split("\t").map(trim)
4.  while header.length && header.at(-1) === "" : header.pop()
        -> removes the phantom 7th column of Control Measures.tsv
5.  for each remaining line:
      a. if line.trim() === "" : skip          (also handles the trailing NL of Air missile.tsv)
      b. cells = line.split("\t").map(trim)    (NO quote handling needed - corpus has zero `"`)
      c. while cells.length < header.length : cells.push("")   // right-pad ragged rows
      d. row = Object.fromEntries(header.map((h,i) => [h, cells[i] ?? ""]))
6.  validate: /^\d{6}$/.test(row.Code)  -> else record a `bad-code` problem and skip
7.  derive the CODE LEVEL (authoritative):
        codeLevel = code.slice(4,6) !== "00" ? 3
                  : code.slice(2,4) !== "00" ? 2
                  : 1
    i.e. the 6 digits are  EE GG SS  (entity / entity type / entity subtype)
8.  derive the CELL LEVEL (a cross-check only):
        cellLevel = Entity ? 1 : EntityType ? 2 : EntitySubtype ? 3 : 0
    cellLevel === 0 -> `no-label` problem.
    cellLevel !== codeLevel -> record a `level-mismatch` problem, but TRUST codeLevel.
9.  forward-fill two carry variables, keyed on codeLevel (NOT on which cells are blank):
        codeLevel 1 : L1 = Entity || EntityType || EntitySubtype ;  L2 = ""   ; name = L1
        codeLevel 2 : L2 = EntityType || Entity  || EntitySubtype ;             name = L2
        codeLevel 3 : name = EntitySubtype || EntityType || Entity
    The `||` chains absorb the two rows in the corpus that fill Entity AND Entity Type on
    the same physical line (see 3.3).
10. path  = [L1] | [L1,L2] | [L1,L2,name]  ->  filter(Boolean)
    label = path.join(" > ")
11. Remarks: trim; drop when empty. `Geometric Rendering`: trim; present only for set 25.
12. Deprecation: a label matching /^\{.*\}$/ (literally `{Disused}`) is a reserved-but-retired
    code slot. Keep it resolvable, hide it from search.
13. Duplicate detection: a Map<code, firstLine> per file.
```

Why `codeLevel` and not indentation: indentation via blank cells is *redundant* with the
code, and the code is machine-checkable. Running both and comparing is how I proved the
corpus is clean.

### 3.2 The parser — `research/scratch/parse-catalog.mjs`

Written and run. It is self-contained (no dependency on `milstandard-e`'s own JS), exports
`SYMBOL_SETS`, `readTSV`, `parseEntityTable`, `parseModifierTable`, and writes
`research/scratch/catalog.json`.

```
$ node research/scratch/parse-catalog.mjs
```

### 3.3 Results

```
TOTAL entity rows (counting the shared SIGINT table 5x): 1721
Unique entity rows (each TSV once):                      1705

set  name                                   ents   L1   L2   L3  {Disused}   m1   m2
01   Air                                      53    4   16   33      1        41   12
02   Air Missile                                1    1    0    0      0         9   16
05   Space                                     36    3   33    0      0         7   12
06   Space Missile                              1    1    0    0      0         4   15
10   Land Unit                                214   11  153   50     21        99   89
11   Land Civilian Unit/Organization           11    1   10    0      0        26    2
15   Land Equipment                           206   15  102   89     11        27   10
20   Land Installation                        131    2   37   92      1        13   10
25   Control Measure                          628   24  403  201      7        51    5
27   Dismounted Individual                     45    1    4   40      1        34   39
30   Sea Surface                               93    7   20   66      0        25   16
35   Sea Subsurface                            22    8   11    3      0        22   17
36   Mine Warfare                              65   11   25   29      0         0    0
40   Activity/Event                           152    8   42  102      3        22    2
50   Signals Intelligence – Space               4    1    3    0      0        65    1
51   Signals Intelligence – Air                 4    1    3    0      0        65    1
52   Signals Intelligence – Land                4    1    3    0      0        65    1
53   Signals Intelligence – Surface             4    1    3    0      0        65    1
54   Signals Intelligence – Subsurface          4    1    3    0      0        65    1
60   Cyberspace                                43    8   28    7      2        13    7
common modifiers: sector1=67 (Category) sector2=26 (Category)

PROBLEMS: 0
{}
```

**Zero failures of any kind**: no malformed `Code`, no duplicate code inside any file,
no unlabelled row, and — notably — **no `level-mismatch`**: the indentation pattern and the
6-digit code agree on all 1 721 rows.

Other totals from the same run: **47** `{Disused}` entity rows, **120** rows carrying a
`Remarks` string (110 of which are `Reserved for hierarchical purposes.` / `Reserved for
Amplifier field Special Headquarters.`).

### 3.4 Cross-validation against `milstandard-e`'s own parser

`research/scratch/probe4.mjs` compares my reconstructed label against
`[Entity, Entity Type, Entity Subtype]` from `ms2525e[set].mainIcon`, for all 1 721 rows.

```
checked 1721 diffs 6
DIFF 50 110000 | lib: Signal Intercept > Signal Intercept | mine: Signal Intercept
DIFF 51 110000 | ... (same, 51-54)
DIFF 01 140000 | lib: Manual Track > Manual Track        | mine: Manual Track
```

The only 6 differences come from the two source rows that fill `Entity` **and**
`Entity Type` with the same string on one physical line:

```
Signals intelligence.tsv : "Signal Intercept\tSignal Intercept\t\t110000\tReserved for hierarchical purposes."
Air.tsv                  : "Manual Track\tManual Track\t\t140000"
```

`tsv2json` emits a duplicated label; my parser collapses it because the code (`110000`,
`140000`) is unambiguously level 1. **Use my behaviour** — `"Signal Intercept > Signal
Intercept"` is a data artefact, not a real hierarchy.

### 3.5 Verified label reconstruction

```
110000 => "Command and Control"                                     (set 10)
111000 => "Command and Control > Signal"
111001 => "Command and Control > Signal > Radio"          <-- the example from the brief
111005 => "Command and Control > Signal > Video Imagery (Combat Camera)"
121100 => "Movement and Maneuver > Infantry"
```

---

## 4. Sector-1 / sector-2 modifier tables

### 4.1 Shape

Four columns, always: `First Modifier | Second Modifier`, `Category | Capability`, `Code`,
`Remarks`. Same raggedness (trailing `Remarks` omitted), same CRLF, same lack of quoting.

**Three files use `Capability` where every other file uses `Category`** — this is a header
inconsistency you must tolerate, not a semantic difference:

* `Control Measures sector 1.tsv`
* `Cyberspace sector 1.tsv`
* `Land civilian sector 1.tsv`

Parse with `const catCol = header.includes("Category") ? "Category" : "Capability";`.

### 4.2 Code width — 2 digits per symbol set, 3 digits for Common

Verified by measuring every `Code` cell:

| table family | width | range |
|---|---|---|
| all 30 per-symbol-set sector files | **2** | `01` … `99` |
| `Common Modifiers sector 1.tsv` | **3** | `100` … `166` (67 rows, contiguous) |
| `Common Modifiers sector 2.tsv` | **3** | `100` … `125` (26 rows, contiguous) |

This matches milsymbol exactly. `src/numbersidc/metadata.js`:

```js
const functionid = metadata.functionid = sidc.substr(10, 10);
metadata._modifier1 = (sidc.substr(20,1) || "0") + (functionid.substr(6,2) || "00");
metadata._modifier2 = (sidc.substr(21,1) || "0") + (functionid.substr(8,2) || "00");
```

and `src/symbolfunctions/icon.js` dispatches on the leading digit:

```js
if (this.metadata._modifier1.substr(0,1) == "0") {        // leading 0 -> per-symbol-set table
  if (functionid.substr(6,2) != "00") drawArray2.push(m1[functionid.substr(6,2)]);  // 2-digit key
} else {                                                   // leading 1 -> common table
  drawArray2.push(m1[this.metadata._modifier1]);                                    // 3-digit key
}
```

So **SIDC position 20 (0-indexed) is the sector-1 "bank selector" and position 21 the
sector-2 one.** `0` selects the symbol set's own 2-digit table, `1` selects the shared
3-digit `Common Modifiers` table (`100`–`166` / `100`–`125`). Confirmed at runtime: all
67 common m1 codes and all 26 common m2 codes render when supplied that way (§5.4).

`src/numbersidc/sidc/common.js` registers exactly `sIdm1["100"] … sIdm1["166"]` (67 live
entries plus one commented-out `//sIdm1["01"]`) and `sIdm2["100"] … sIdm2["125"]` (26).
Counts match the TSVs 1:1.

### 4.3 Which symbol sets "share" tables

Two distinct kinds of sharing, easy to conflate:

1. **The `Common Modifiers` tables are shared by *every* symbol set.** They are not attached
   to any set in `2525e.js`; they live under the `common` key and are reached exclusively
   through the SIDC bank-selector digits at positions 20/21. `numbersidc.js` registers
   `common` only in the `std2525e` icon bundle — **not** in `app6d` or `std2525d`, i.e.
   3-digit modifiers are an E-edition feature.
2. **`Signals intelligence sector 1/2.tsv` are shared by symbol sets 50, 51, 52, 53, 54**
   (identical object references in `2525e.js`). Everything else is 1:1.
3. **Symbol set 36 (Mine Warfare) has no modifier tables at all** — `2525e.js` literally
   calls `tsv2json("")` for both sectors, with the real imports commented out. Any UI must
   hide both modifier pickers for set 36.

### 4.4 Full per-set modifier table map

| set | sector-1 file | rows | code range | cat. column | sector-2 file | rows | code range | cat. column |
|---|---|---|---|---|---|---|---|---|
| 01 | `Air sector 1.tsv` | 41 | 01–41 | Category | `Air sector 2.tsv` | 12 | 01–12 | Category |
| 02 | `Air missile sector 1.tsv` | 9 | 01–09 | Category | `Air missile sector 2.tsv` | 16 | 01–16 | Category |
| 05 | `Space sector 1.tsv` | 7 | 01–07 | Category | `Space sector 2.tsv` | 12 | 01–12 | Category |
| 06 | `Space missile sector 1.tsv` | 4 | 01–04 | Category | `Space missile sector 2.tsv` | 15 | 01–15 | Category |
| 10 | `Land unit sector 1.tsv` | 99 | 01–99 | Category | `Land unit sector 2.tsv` | 89 | 01–89 | Category |
| 11 | `Land civilian sector 1.tsv` | 26 | 01–26 | **Capability** | `Land civilian sector 2.tsv` | 2 | 01–02 | Category |
| 15 | `Land equipment sector 1.tsv` | 27 | 01–27 | Category | `Land equipment sector 2.tsv` | 10 | 01–10 | Category |
| 20 | `Land installation sector 1.tsv` | 13 | 01–13 | Category | `Land installation sector 2.tsv` | 10 | 01–10 | Category |
| 25 | `Control Measures sector 1.tsv` | 51 | 01–51 | **Capability** | `Control Measures sector 2.tsv` | 5 | 01–05 | Category |
| 27 | `Dismounted individual sector 1.tsv` | 34 | 01–54 **(gaps)** | Category | `Dismounted individual sector 2.tsv` | 39 | 01–39 | Category |
| 30 | `Sea surface sector 1.tsv` | 25 | 01–25 | Category | `Sea surface sector 2.tsv` | 16 | 01–16 | Category |
| 35 | `Sea subsurface sector 1.tsv` | 22 | 01–22 | Category | `Sea subsurface sector 2.tsv` | 17 | 01–17 | Category |
| 36 | — | 0 | — | — | — | 0 | — | — |
| 40 | `Activities sector 1.tsv` | 22 | 01–22 | Category | `Activities sector 2.tsv` | 2 | 01–02 | Category |
| 50–54 | `Signals intelligence sector 1.tsv` | 65 | 01–65 | Category | `Signals intelligence sector 2.tsv` | 1 | 01–01 | Category |
| 60 | `Cyberspace sector 1.tsv` | 13 | 01–13 | **Capability** | `Cyberspace sector 2.tsv` | 7 | 01–08 **(gap: 04)** | Category |
| *(common)* | `Common Modifiers sector 1.tsv` | 67 | **100–166** | Category | `Common Modifiers sector 2.tsv` | 26 | **100–125** | Category |

**Codes are not always contiguous.** Only two tables have holes:
`27 sector 1` is missing `10, 27–45`; `60 sector 2` is missing `04`. Everything else is a
dense run from `01`.

### 4.5 `{Disused}` modifiers

**194** modifier rows across the unique files are the literal string `{Disused}` — retired
2525D slots kept so the codes stay reserved. Breakdown (unique files):
set 10 m1=29/m2=21, 11 m1=12/m2=1, 15 m1=21/m2=9, 20 m1=6/m2=1, 27 m1=12/m2=4,
30 m1=15/m2=7, 35 m1=14/m2=4, 40 m1=9/m2=2, 01 m1=14/m2=8, 02 m2=1, 05 m1=1/m2=1,
SIGINT m1=1/m2=1. The `Common Modifiers` tables have **zero** `{Disused}` rows.

Note that milsymbol still draws geometry for most `{Disused}` slots (they are the old
D-edition modifiers), so they are *renderable but not selectable*. Hide them from search;
keep them resolvable so pasted SIDCs still work.

### 4.6 `Category` vocabularies

Sector 1 (across all files incl. common), 33 distinct values:
`"" · Air Radar · Aircraft Type · Asset Capability · CBRN · CBRN Type · Capability ·
Communications · Composite Loss · Composite Loss or Incident Qualifier · Crime ·
Electric Power Type · IED Category · Incident Qualifier · Jammer · Land Radar ·
Launch Origin · Military Aircraft Type · Military Information Support Operations ·
Military Mission Area · Missile Class · Mission Area · Mission area · Mobility ·
Obstacles · Orbit · Organization · Radar · Sensor Type · Submarine Confidence ·
Support Level · Telecommunication Type · Weapons Capability`

Sector 2, 16 distinct values:
`"" · Capability · Cargo Capacity · Launch Origin · Missile Destination · Missile Range ·
Missile Status · Missile Type-AAW · Missile Type-BMD · Mobility · Organization ·
Re-Fueling Capability · Sensor · Ship Mobility · Ship Propulsion · Track Link Availability`

Note `Mission Area` **and** `Mission area` both occur — normalise case if you group by category.

---

## 5. Coverage report — does milsymbol actually draw each entity?

### 5.1 Method (verifiable, in `research/scratch/coverage.mjs`)

SIDC template, 20 digits, built from milsymbol's own field offsets in
`src/numbersidc/metadata.js`:

```
pos  0-1  "13"      version. metadata.js: version 13|14 -> edition "E"; 10|11|12 -> "D"
pos  2    "0"       context = Reality
pos  3    "3"       standard identity 2 = Friend
pos  4-5  <SS>      symbol set
pos  6    "0"       status = Present
pos  7    "0"       HQ / task force / dummy = none
pos  8-9  "00"      echelon / mobility = none
pos 10-15 <EEEEEE>  6-digit entity code from the catalog
pos 16-17 "00"      sector-1 modifier (low 2 digits)
pos 18-19 "00"      sector-2 modifier (low 2 digits)
[pos 20]            sector-1 bank selector, defaults "0"      (E-edition extension)
[pos 21]            sector-2 bank selector, defaults "0"      (E-edition extension)
[pos 22]            frame-shape override, defaults "0"        (E-edition extension)
```
The 21st–23rd positions are read by milsymbol via `sidc.substr(20,1) || "0"` etc.; a plain
20-digit string works. **[The 21+ positions are milsymbol's convention; UNVERIFIED against
the published APP-6E text.]**

Rendering: `new ms.Symbol(sidc, { standard: "APP6", size: 100 })`. `standard:"APP6"` sets
`metadata.STD2525 = false` (`src/ms/symbol/getmetadata.js:80`), which is what selects the
APP-6 icon variants inside `ms._getIconParts`.

Classification per entity:
* `error` — the constructor threw (never happened).
* `undefined-glyph` — `symbol.validIcon === false`. milsymbol did **not** find the entity
  code and pushes its hard-coded question-mark path (`src/symbolfunctions/icon.js` ~line 243).
  This is worse than nothing: the plugin would emit a `?` into the Figma canvas.
* `frame-only` — `validIcon === true` but the SVG is byte-identical to the same symbol set
  rendered with entity code `000000` (and an icon-only render with `frame:false` adds no
  elements). The code is *recognised* but maps to an empty icon array.
* `icon` — real geometry drawn.

Two milsymbol behaviours worth knowing before reading the numbers
(`src/symbolfunctions/icon.js`):
* If `icons[code]` is undefined **and** `code.substr(4,2) >= 95`, milsymbol retries
  `code.substr(0,4) + "00"` — subtype slots 95–99 inherit the parent icon.
* Subtype `95/96/97/98` additionally stamp HQ / division-support / corps-support /
  theatre-support decorations on top.

### 5.2 Per-symbol-set results

Full machine-readable output: **`research/coverage.json`**
(384 KB). Top level: `{ generated, milsymbol, milstandardE, method, perSet, entities[],
modifierCoverage, commonModifierCoverage }`. One `entities[]` record per (set, code):

```json
{"set":"10","code":"111001","level":3,"label":"Command and Control > Signal > Radio",
 "sidc":"13031000001110010000","status":"icon","children":0,"validIcon":true,
 "svgElements":3,"baselineElements":1}
```

`children` is the number of catalog rows below this code (`0` ⇒ a true selectable leaf);
`perSet[set].leafGaps` counts non-`{Disused}` leaves with no icon.

`leafGaps` = entities with `children === 0`, not `{Disused}`, and no icon — the only gaps a
user can actually hit.

| set | name | total | with icon geometry | no geometry | of which `undefined-glyph` | **leafGaps** |
|---|---|---|---|---|---|---|
| 01 | Air | 53 | **52** | 1 | 0 | **0** |
| 02 | Air Missile | 1 | **1** | 0 | 0 | **0** |
| 05 | Space | 36 | **36** | 0 | 0 | **0** |
| 06 | Space Missile | 1 | **1** | 0 | 0 | **0** |
| 10 | Land Unit | 214 | **208** | 6 | 0 | **0** |
| 11 | Land Civilian Unit/Organization | 11 | **11** | 0 | 0 | **0** |
| 15 | Land Equipment | 206 | **206** | 0 | 0 | **0** |
| 20 | Land Installation | 131 | **129** | 2 | 0 | **0** |
| 25 | **Control Measure** | 628 | **264** | **364** | **364** | **292** |
| 27 | Dismounted Individual | 45 | **41** | 4 | 0 | **0** |
| 30 | Sea Surface | 93 | **93** | 0 | 0 | **0** |
| 35 | Sea Subsurface | 22 | **22** | 0 | 0 | **0** |
| 36 | Mine Warfare | 65 | **64** | 1 | 0 | **0** |
| 40 | Activity/Event | 152 | **147** | 5 | 0 | **0** |
| 50 | SIGINT – Space | 4 | **3** | 1 | 0 | **0** |
| 51 | SIGINT – Air | 4 | **3** | 1 | 0 | **0** |
| 52 | SIGINT – Land | 4 | **3** | 1 | 0 | **0** |
| 53 | SIGINT – Surface | 4 | **3** | 1 | 0 | **0** |
| 54 | SIGINT – Subsurface | 4 | **3** | 1 | 0 | **0** |
| 60 | Cyberspace | 43 | **36** | 7 | 0 | **0** |
| **TOTAL** | | **1721** | **1326** | **395** | **364** | **292** |

Outside symbol set 25 the coverage is **1 062 / 1 093 = 97.2 %**, and every one of the
31 misses is either a parent/category node that still has children or a `{Disused}`
placeholder — i.e. **there are zero real icon gaps outside Control Measures.**

### 5.3 The 31 non-Control-Measure gaps, in full (this is the whole list, under the 40 cap)

| set | code | status | label | why |
|---|---|---|---|---|
| 01 | 110106 | frame-only | Military > Fixed Wing > **{Disused}** | retired slot |
| 10 | 120000 | frame-only | Movement and Maneuver | L1 parent |
| 10 | 130000 | frame-only | Fires | L1 parent |
| 10 | 140000 | frame-only | Protection | L1 parent |
| 10 | 150000 | frame-only | Intelligence | L1 parent |
| 10 | 170000 | frame-only | Naval | L1 parent |
| 10 | 180000 | frame-only | Named Headquarters | L1 parent |
| 20 | 120000 | frame-only | Infrastructure | L1 parent |
| 20 | 120700 | frame-only | Infrastructure > Medical | L2 parent (2 children) |
| 27 | 110000 | frame-only | Military | L1 parent |
| 27 | 110100 | frame-only | Military > **{Disused}** | retired slot |
| 27 | 110200 | frame-only | Military > Activity/Task | L2 parent |
| 27 | 110300 | frame-only | Military > Lethal Weapons | L2 parent |
| 36 | 140000 | frame-only | Mine–Like Contact (MILCO) | L1 parent |
| 40 | 110000 | frame-only | Incident | L1 parent |
| 40 | 130000 | frame-only | Operation | L1 parent |
| 40 | 130400 | frame-only | Operation > Recruitment | L2 parent (2 children) |
| 40 | 150000 | frame-only | Hazardous Materials | L1 parent |
| 40 | 180000 | frame-only | Individual | L1 parent |
| 50 | 110000 | frame-only | Signal Intercept | L1 parent |
| 51 | 110000 | frame-only | Signal Intercept | L1 parent |
| 52 | 110000 | frame-only | Signal Intercept | L1 parent |
| 53 | 110000 | frame-only | Signal Intercept | L1 parent |
| 54 | 110000 | frame-only | Signal Intercept | L1 parent |
| 60 | 110000 | frame-only | Cyberspace Unit/… (non specified) | L1 parent |
| 60 | 110400 | frame-only | … > **{Disused}** | retired slot |
| 60 | 110500 | frame-only | … > **{Disused}** | retired slot |
| 60 | 130000 | frame-only | Agent | L1 parent |
| 60 | 150000 | frame-only | Threat | L1 parent |
| 60 | 170000 | frame-only | Endpoint | L1 parent |
| 60 | 170300 | frame-only | Endpoint > Portable Electronic Device (PED) | L2 parent (7 children) |

Classified programmatically: of these 31, **4 are `{Disused}` placeholders and 27 are
parent nodes that still have children in the catalog. Zero are true leaves.** In other
words, **milsymbol 3.0.4 has an icon for every selectable APP-6E entity outside symbol
set 25.** Note the asymmetry in the other direction: many L1 "reserved" rows *do* draw (24 non-CM ones,
e.g. `15/120000 Vehicle`, `30/110000 Military`, `11/110000 Civilian`) — the `Reserved for
hierarchical purposes.` remark does **not** predict renderability. Trust `coverage.json`,
not the remark.

### 5.4 Control Measures (25): the one real problem

Drawn vs. not, split by `Geometric Rendering`:

| geometry | rows | drawn | not drawn (all `undefined-glyph`) |
|---|---|---|---|
| Point | 254 | **254** | 0 |
| Area | 195 | 5 | **190** |
| Line | 95 | 0 | **95** |
| Corridor | 7 | 0 | **7** |
| Axis | 5 | 0 | **5** |
| *(empty cell)* | 72 | 5 | **67** |
| **total** | **628** | **264** | **364** |

**Rule: milsymbol renders exactly the `Point` control measures, and nothing else.**
Lines, areas, axes and corridors are multi-anchor tactical graphics that milsymbol does not
model at all. The 10 non-`Point` rows that do draw are:

```
131000 (none)  Command and Control Points > Fly-To-Point
160200 (none)  Maneuver Points > Observation Post/Outpost (specified)
180000 (none)  Airspace Control Points                     <- an L1 group that happens to have an icon
200400 Area    Maritime Control Areas > Ship Area of Interest
200500 Area    Maritime Control Areas > Active Maneuver Area
214000 (none)  Maritime Control Points > {Disused}
270701 Area    Protection Areas > Minefield > Static Depiction
320100 (none)  Sustainment Points > Ambulance Points
341400 Area    Mission Tasks > Interdict
342800 Area    Mission Tasks > Suppress
```

**Action for the plugin:** ship a per-entity `renderable` flag derived from
`coverage.json`. For the 364 non-renderable control measures either hide them or show them
greyed with "no single-point symbol in APP-6E", and **never** let milsymbol's question-mark
glyph reach the Figma canvas. A cheap runtime guard is
`if (!symbol.validIcon) { /* refuse */ }`.

### 5.5 Modifier coverage (bonus, also in `coverage.json`)

Each 2-digit modifier probed on a drawable anchor entity of its own symbol set:

| set | sector 1 | sector 2 | missing |
|---|---|---|---|
| 01 | 41/41 | 12/12 | — |
| 02 | 9/9 | 16/16 | — |
| 05 | 7/7 | 12/12 | — |
| 06 | 4/4 | 15/15 | — |
| 10 | 99/99 | 85/89 | m2 `79 80 85 88` — all `{Disused}` |
| 11 | 26/26 | 2/2 | — |
| 15 | 24/27 | 9/10 | m1 `25 26 27`, m2 `10` — all `{Disused}` |
| 20 | 13/13 | 10/10 | — |
| 25 | **39/51** | 5/5 | m1 `01`–`12`, the Mobility block (`Wheeled…`, `Tracked`, `Towed`, `Rail`, `Barge`, `Amphibious`, `No Vehicles`) |
| 27 | 34/34 | 39/39 | — |
| 30 | 25/25 | 16/16 | — |
| 35 | 22/22 | 17/17 | — |
| 36 | n/a | n/a | no tables |
| 40 | 22/22 | 2/2 | — |
| 50–54 | 65/65 | 1/1 | — |
| 60 | 13/13 | 7/7 | — |
| **common (3-digit)** | **67/67** | **26/26** | — |

Modifier coverage is essentially complete. The only non-`{Disused}` hole is the
Control-Measures mobility block `25 / sector 1 / 01–12`.

### 5.6 APP-6 vs 2525 rendering divergence

Same 1 721 SIDCs rendered with `standard:"APP6"` and `standard:"2525"`:
**152 / 1 721 (8.8 %) produce different SVG.** Per set:
`20` 45/131 · `40` 37/152 · `30` 29/93 · `15` 13/206 · `05` 12/36 · `10` 7/214 · `25` 4/628 ·
`01` 3/53 · `35` 2/22. Sets `02 06 11 27 36 50–54 60` are identical in both modes.
If the plugin offers a standard toggle, it must re-render, not re-colour.

---

## 6. Recommended shipped catalog JSON

### 6.1 Measured sizes (from `research/scratch/compact.mjs`)

| shape | raw | gzip | brotli |
|---|---|---|---|
| my full `catalog.json` (objects, `path[]`, `label`, `source{}`) | 914 KB | — | — |
| flat verbose array (`{set,code,label,level,geometry,remarks}` × 1721) | 220 KB | 22.7 KB | — |
| **compact tuple form (recommended)** | **105 KB** | **23.2 KB** | **18.4 KB** |

A Figma plugin bundle is a single JS file with no HTTP compression on `code.js`, so the
**raw** number is what matters for the main thread; the UI iframe *is* gzipped if you load
the catalog with `fetch`. 105 KB raw is fine to inline; do **not** inline the 914 KB form.

### 6.2 The shape

```jsonc
{
  "v": "13",                       // SIDC version digits this catalog targets (edition E)
  "sets": [                        // 20 entries
    { "s": "10", "n": "Land Unit", "t": "landunit" }   // t = key into `tables`
    // 50..54 all point at "sigint" -> the 4 shared rows are stored ONCE
  ],
  "tables": {
    "landunit": [
      // [code, name, level, flags, geometry?]
      ["110000", "Command and Control",            1, 1],
      ["110100", "Broadcast Transmitter Antennae", 2, 0],
      ["111000", "Signal",                         2, 0],
      ["111001", "Radio",                          3, 0]
    ],
    "controlmeasure": [
      ["110000", "Command and Control Lines", 1, 1],
      ["110100", "Boundary",                  2, 1, "L"]
    ]
  },
  "m1": { "10": [["01","Tactical Satellite Communications","Communications"], …] },
  "m2": { "10": [["01","…","…"], …] },
  "cm1": [["100","Unmanned Aircraft (UA)/…","Mobility"], …],   // 3-digit common, 67
  "cm2": [["100","Airborne","Mobility"], …]                    // 3-digit common, 26
}
```

Rules that keep it small and fast:

1. **Store only the leaf `name`, never the full `label`.** Rebuild `"A > B > C"` at load
   time by walking the code: a level-3 row's parents are `code[0..1]+"0000"` and
   `code[0..3]+"00"`. This is a pure function of the code, costs one Map lookup each, and
   saves ~110 KB of repeated ancestor text.
2. **Tuples, not objects.** Key names repeated 1 721× are the single biggest waste.
3. **Deduplicate the SIGINT table by reference** (`sets[].t`). Saves 4 copies.
4. **`flags` is a bitfield**, not booleans:
   `1 = no icon geometry` (from `coverage.json`), `2 = {Disused}`, `4 = level-1/level-2
   parent with children` (precompute), `8 = control measure that is not a Point`.
   One small integer replaces four keys.
5. **Geometry as a single letter** for set 25 only: `P L A C X` (Point/Line/Area/Corridor/Axis),
   omitted elsewhere.
6. **Drop `Remarks` from the shipped bundle.** 120 rows carry one and 110 of those are the
   boilerplate `Reserved for hierarchical purposes.`; keep a 3-entry lookup table if you
   want to surface them.
7. **Do not ship `source{}`/line numbers.** Dev-only.

### 6.3 Search index for a type-ahead over ~1 700 entries

1 721 entities is *small*. Measured: **1 306 distinct lowercase alphanumeric tokens** across
all labels. Do not reach for a library.

**Build at plugin start (≈5 ms):**

```js
// one flat array, one string per entity, precomputed once
const haystack = entities.map(e =>
  (e.label + " " + e.setName + " " + e.code).toLowerCase()
);
```

**Rank, don't just filter.** Score each candidate and sort:

| condition | score |
|---|---|
| query is 6 digits and equals `code` | 1000 |
| leaf `name` starts with the query | 100 |
| any word in `label` starts with the query | 60 |
| `label` contains the query | 30 |
| all query tokens appear somewhere (AND-of-substrings, order-free) | 15 |
| penalty: entity has `flags & 1` (no icon) | −40 |
| penalty: entity has `flags & 2` (`{Disused}`) | −1000 (exclude unless "show retired") |
| bonus: level 3 leaf | +5 |

**An inverted index is optional but cheap and makes the AND-of-tokens case O(1):**

```js
const inverted = new Map();            // token -> Uint16Array of entity indices
entities.forEach((e, i) => {
  for (const t of tokenize(e.label)) {
    // index every prefix of length 1..min(len,8) for instant prefix search
    for (let k = 1; k <= Math.min(t.length, 8); k++) {
      const p = t.slice(0, k);
      (inverted.get(p) ?? inverted.set(p, []).get(p)).push(i);
    }
  }
});
```
Prefix-expanding to 8 chars over 1 306 tokens costs roughly 8 k map entries — negligible,
and it removes any need to scan 1 721 strings per keystroke. Cap results at ~50 and debounce
the input by 60–100 ms.

**Synonyms are where real search quality comes from here.** The labels are full of
parenthesised expansions (`Unmanned Aircraft (UA) / Unmanned Aerial Vehicle (UAV) / …`,
`Medical Evacuation (MEDEVAC)`, `Military Information Support Operations (MISO)`). Index the
acronym *and* the expansion by tokenising on `/`, `(`, `)` and `,` as well as whitespace —
my tokenizer (`split(/[^a-z0-9]+/)`) already does this, which is how "medevac", "uav" and
"miso" become first-class tokens. Add a tiny hand-written alias map for the ones the data
does not spell out (`inf → Infantry`, `arty → Field Artillery`, `recce/recon → Reconnaissance`,
`hq → Headquarters`, `ew → Electronic Warfare`, `cbrn`, `ied`, `sof`).

**Group results by symbol set** in the dropdown; with 628 control measures in one set an
ungrouped list is unusable.

### 6.4 Build-time generation

Generate the shipped file from `parse-catalog.mjs` + `coverage.mjs` in a `prebuild` npm
script and commit the artefact. That way `milstandard-e` and `milsymbol` stay dev
dependencies for the catalog (milsymbol is still a runtime dependency for rendering), and
a version bump of `milstandard-e` produces a reviewable diff of the catalog rather than a
silent behaviour change.

---

## 7. Open items

* `mil-std-2525` (D edition) is **not installed**, so the requested D-vs-E catalog
  comparison was not performed. `npm i -D mil-std-2525@^0.2.8` (the version milsymbol
  itself dev-depends on) would enable it.
* Symbol set **55** does not exist in either local package; SIGINT is 50–54.
  **[UNVERIFIED against the published APP-6E document.]**
* SIDC positions 21–23 (sector-1 bank, sector-2 bank, frame-shape override) are read by
  milsymbol but I have not confirmed them against the standard's own field table.
  **[UNVERIFIED.]**
* Symbol sets `00`, `12`, `39` appear in milsymbol's `dimensionMapping` but have no data in
  `milstandard-e`. Their intended meaning is unknown. **[UNVERIFIED.]**
* `milstandard-e`'s `Signals intelligence.tsv` has only 4 entity rows. Whether APP-6E really
  defines only 4 SIGINT entities, or the package's table is abridged, could not be
  determined locally. **[UNVERIFIED.]**
