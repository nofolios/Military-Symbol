# APP-6E amplifier fields, echelons, and symbol layout geometry

Implementation reference for the APP-6E Figma plugin.
Target renderer: **milsymbol 3.0.4** (MIT), `node_modules/milsymbol`.

**How this document was produced.** Every number, path string, colour and SIDC below was
either read directly out of `node_modules/milsymbol/src/**` or produced by running
milsymbol 3.0.4 under Node and dumping `asSVG()` / `getMetadata()` / `getSize()` /
`getAnchor()` / `getOctagonAnchor()`. Probe scripts live in
`research/scratch/`
(`01-geometry.mjs`, `02-amplifiers.mjs`, `03-textfields.mjs`, `04-render.mjs`,
`05-render2.mjs`, `06-icons.mjs`, `07-catalog.mjs`, `08-presets.mjs`, `09-colors.mjs`,
`10-anchor.mjs`, `11-version14.mjs`).

Claims are tagged:
* **[ran]** — verified by executing milsymbol 3.0.4 in this session.
* **[src]** — read directly from milsymbol / milstandard-e source.
* **[pub]** — from public APP-6 / 2525 documentation (cross-check only).
* **[unverified]** — could not be confirmed against the authoritative standard text.

> **Correction to the task brief:** `node_modules/mil-std-2525` (the D-edition catalog)
> is **not installed** in this project. `ls node_modules` returns only
> `@esbuild, @figma, esbuild, milstandard-e, milsymbol, preact, typescript`. **[ran]**
> The D-vs-E comparisons below therefore come from milsymbol's own edition switch
> (`metadata.edition`) and from public documentation, not from that package.

---

## 0. SIDC digit layout used by milsymbol

milsymbol touches **only digits 1–23** of a numeric SIDC. A `grep` for every
`sidc.substr(...)` / `sidc.charAt(...)` in `src/` proves digits 24–30 are never read. **[src]**

| Digits | Meaning (milsymbol) | Source |
|---|---|---|
| 1–2 | Version. `10`,`11`,`12` → `metadata.edition = "D"`; `13`,`14` → `"E"` | `src/numbersidc/metadata.js:3,29-34` |
| 3 | Standard Identity 1 = **context**: `0` Reality, `1` Exercise, `2` Simulation | `metadata.js:5,66` |
| 4 | Standard Identity 2 = **affiliation** (see §5) | `metadata.js:6,67` |
| 5–6 | Symbol set | `metadata.js:7` |
| 7 | **Status / operational condition** (see §2.9, §5) | `metadata.js:8` |
| 8 | **HQ / Task force / Feint-dummy** bitfield (see §2.5–2.7) | `metadata.js:9` |
| 9–10 | **Amplifier / descriptor** = echelon, mobility, towed array, leadership (see §2.1–2.4) | `metadata.js:10` |
| 11–16 | Entity / entity type / entity subtype (main icon) | `metadata.js:58` |
| 17–18 | Sector-1 modifier, low digits | `metadata.js:59-61` |
| 19–20 | Sector-2 modifier, low digits | `metadata.js:62-64` |
| 21 | Sector-1 modifier, **high digit** (E edition 3-digit modifier) | `metadata.js:60` |
| 22 | Sector-2 modifier, **high digit** | `metadata.js:63` |
| 23 | **Frame-shape override** (only honoured when `edition === "E"`) | `metadata.js:11,190-228` |
| 24–30 | **Never read by milsymbol** | grep of `src/` |

> ⚠️ **Conflict with published MIL-STD-2525E.** Public discussion of the published E
> edition (Esri `joint-military-symbology-xml` issue #492) states that digits **21–23 are
> the "Symbology Originator Identifier"** (an ISO-3166 numeric country code) and digits
> 24–30 are originator-specified. **[pub]** milsymbol instead uses 21/22 as modifier
> high-digits and 23 as a frame-shape override. **[src]** Which reading matches the final
> STANAG 2019 ed. E text is **[unverified]** — I could not obtain the normative document.
> **Implication for the plugin:** emit `0` in digits 21–23 unless the user explicitly
> asks for a 3-digit sector modifier or a frame-shape override, and never round-trip a
> foreign SIDC's digits 21–30 through milsymbol assuming they are inert.

### Frame-shape override (digit 23) — measured **[ran]**

Only applied when `metadata.edition === "E"` (version `13`/`14`). It clears
`civilian/cyberspace/installation/landequipment/activity/space/unit` first.

| digit 23 | `metadata.dimension` | flags set |
|---|---|---|
| `0` | from symbol set | — (no override) |
| `1` | `Air` | `space = true` |
| `2` | `Air` | — |
| `3` | `Ground` | `unit = true` |
| `4` | `Sea` | `landequipment = true` |
| `5` | `Ground` | `installation = true` |
| `6` | `LandDismountedIndividual` | `dismounted = true` |
| `7` | `Subsurface` | — |
| `8` | `Ground` | `activity = true`, `unit = true` |
| `9` | `Ground` | `unit = true` (note: source sets `cyberspace = false`, i.e. **no cyberspace tail is drawn** — `metadata.js:224`) **[src]** |
| `A` | `Ground` | `frame = false` (unframed) |

---

## 1. Text amplifier fields

### 1.1 Field-letter master table

Letters I, O and U are not used, to avoid confusion with digits/similar glyphs. **[pub]**

Columns: **Field** = APP-6/2525 field ID · **milsymbol option** = key you pass to
`new ms.Symbol(sidc, { … })` · **Where drawn** = measured position at default styling
(see §1.2) · **Status** = whether milsymbol 3.0.4 actually renders it.

| Field | Name | Contains | Position around frame | milsymbol option | Status |
|---|---|---|---|---|---|
| A | Symbol icon | The icon itself (entity/type/subtype) | inside frame | *(SIDC digits 11–16)* | rendered as icon, not a text option |
| B | Echelon / size | Graphic echelon amplifier | centred above frame | *(SIDC digits 9–10)* | graphic — see §2.1 |
| C | Quantity | Count of equipment items | centred **above** frame (**below** for dismounted individuals) | `quantity` | ✅ rendered **[ran]** |
| D | Task force indicator | Bracket over the frame | above frame | *(SIDC digit 8)* | graphic — see §2.6 |
| E | Frame (reduced/unfilled) | Frame shape itself | — | *(style `frame`,`fill`)* | n/a |
| F | Reinforced / reduced | `(+)`, `(-)`, `(±)` | right column row 1 (**land units only**) | `reinforcedReduced` | ✅ **[ran]** |
| G | Staff comments | free text | right column row 2 | `staffComments` | ✅ **[ran]** |
| H | Additional information | free text | right column row 3 | `additionalInformation` | ✅ **[ran]** |
| J | Evaluation rating | reliability letter + credibility digit | right column row 5 | `evaluationRating` | ✅ **[ran]** |
| K | Combat effectiveness | e.g. `GREEN` | right column row 5 | `combatEffectiveness` | ✅ **[ran]** |
| L | Signature equipment | `!` = detectable electronic signature | right column row 5 | `signatureEquipment` | ✅ **[ran]** |
| M | Higher formation | parent unit, e.g. `III` | right column row 4 | `higherFormation` | ✅ **[ran]** |
| N | Hostile (enemy) | `ENY` | right column row 5 | `hostile` | ✅ **[ran]** |
| P | IFF / SIF | IFF modes/codes | right column row 5 (land) / row 2 (air) / row 3 (sea) | `iffSif` | ✅ **[ran]** |
| Q | Direction of movement | bearing in degrees | arrow drawn from frame | `direction` (Number) + `speedLeader` | ✅ **[ran]** — see §2.12 |
| R | Mobility indicator | graphic under the frame | below frame | *(SIDC digits 9–10)* | graphic — see §2.2 |
| R2 | SIGINT mobility | `M`/`S`/`U` | *(would sit under frame)* | `sigint` | ❌ **accepted but never drawn** — appears only in the `textFields` truthiness test at `textfields.js:227`; no draw instruction exists **[src]** |
| S | HQ staff / offset location | staff line from frame to true location | left/bottom of frame | *(SIDC digit 8)* | graphic — see §2.5, §2.8 |
| T | Unique designation | unit name/number, track number | left column row 4 (land) / right row 1 (air, sea, sub) | `uniqueDesignation` | ✅ **[ran]** |
| V | Type | equipment type | left column row 3 (land) / right row 3 (air) / right row 2 (sea, sub) | `type` | ✅ **[ran]** |
| W | DTG | date-time group `DDHHMMSSZMONYYYY` | left column row 1 | `dtg` | ✅ **[ran]** |
| X | Altitude / depth | altitude, flight level, depth | left column row 2 (land) / right row 4 (air) / right row 3 (sub) | `altitudeDepth` | ✅ **[ran]** |
| Y | Location | lat/long or UTM | left column row 2 (land) / right row 5 (sea) | `location` | ✅ **[ran]** |
| Z | Speed | velocity | left column row 5 (land) / right row 4 (air) / right row 5 (sea) | `speed` | ✅ **[ran]** |
| AA | Special C2 headquarters | HQ name **inside** the frame | centred inside frame, x=100 y=103, bold | `specialHeadquarters` | ✅ **[ran]** |
| AB | Feint / dummy indicator | dashed inverted-V over the frame | above frame | *(SIDC digit 8)* | graphic — see §2.7 |
| AC | Country | three-letter country code | right column row 1 (equipment / installations / activities / dismounted) | `country` | ✅ **[ran]** |
| AD | Platform type | `ELNOT` / `CENOT` | left column row 3 | `platformType` | ✅ **[ran]** |
| AE | Equipment teardown time | minutes | left row 3 (units) / right row 3 (equipment, installations) | `equipmentTeardownTime` | ✅ **[ran]** |
| AF | Common identifier | e.g. `HAWK` | right row 3 (units) / left row 3 (equipment, installations) | `commonIdentifier` | ✅ **[ran]** |
| AG | Auxiliary equipment indicator | towed sonar array etc. | — | `auxiliaryEquipmentIndicator` | ❌ **accepted but never drawn** (`textfields.js:238` truthiness only) **[src]** |
| AH | Area of uncertainty / HQ element | e.g. `TOC` | centred **below** frame, bold 35 | `headquartersElement` | ✅ **[ran]** |
| AI | Installation composition | | left column row 3 (equipment, installations) | `installationComposition` | ✅ **[ran]** |
| AJ | Platform type (2) / capacity | | — | *(none)* | ❌ no option |
| AK | Capacity / control | | — | *(none)* | ❌ no option |
| AL | Operational condition (alt) | | — | *(style `simpleStatusModifier`)* | graphic — see §2.10 |
| AM | Distance | radius / range in metres | — | *(none)* | ❌ no option (declared only as a comment in `src/ms/symbol.js:38`) **[src]** |
| AN | Azimuth | sector bearing | — | *(none)* | ❌ no option (comment only, `symbol.js:39`) **[src]** |
| AO | Engagement bar | `A:BBB-CC` target-priority bar | bar **above** everything already drawn | `engagementBar` + `engagementType` | ✅ **[ran]** — see §2.11 |
| AP | Target number | `AANNNN` | — | `targetNumber` | ⚠️ **only for control-measure label overrides** (`src/numbersidc/labels/tactical-points.js`), never on framed symbols **[src]** |
| AQ | Guarded unit | BMD designation | left column row 1 (sea surface only) | `guardedUnit` | ✅ **[ran]** |
| AR | Special designator | NRT/SIG track designator | left column row 1 (sea surface, subsurface) | `specialDesignator` | ✅ **[ran]** |
| AS | Sub-surface / sonar | — | — | *(none)* | ❌ no option |

**Undeclared extension options read by `textfields.js` but not initialised in
`src/ms/symbol.js`** — pass them only if you add a country-flag symbol part: **[src]**

| option | effect |
|---|---|
| `country_flag` | reserves `flag = 70` units of horizontal space before the R4/R5 text |
| `full_frame_flag` | sets `flag = 0` when affiliation is Friend **and** dimension is Ground |
| `signature` | if exactly `"!"`, adds `30` to `flag` |
| `stack` | integer; adds `stack * 15` of x-offset to every right-column field and draws `stack` ghost frames (see §2.13) |

### 1.2 Exact rendered geometry of the text block **[ran]**

All coordinates are in milsymbol's internal 0–200 space (see §3). With
`infoSize = fs` (default **40**) and the frame bounding box `bbox`:

```
left  column:  x = bbox.x1 - 20                      text-anchor="end"
right column:  x = bbox.x2 + 20 + (stack*15)         text-anchor="start"
               rows R4/R5 additionally shift by +flag

row 1: y = 100 - 1.5*fs      (=  40 at fs=40)
row 2: y = 100 - 0.5*fs      (=  80)
row 3: y = 100 + 0.5*fs      (= 120)
row 4: y = 100 + 1.5*fs      (= 160)
row 5: y = 100 + 2.5*fs      (= 200)

C  (quantity)            x=100, y = bbox.y1 - 10,   anchor=middle, size=fs
C  (dismounted only)     x=100, y = bbox.y2 + fs,   anchor=middle, size=fs
AA (specialHeadquarters) x=100, y = 103,            anchor=middle, bold,
                         size = 45 (len 1–2) / 39 (len 3) / 33 (len ≥4)
AH (headquartersElement) x=100, y = bbox.y2 + 35,   anchor=middle, bold, size=35
AO (engagementBar text)  x=100, y = this.bbox.y1 - 11, anchor=middle, bold, size=22
```

Source: `src/symbolfunctions/textfields.js` (rows: lines 604–767; C: 246–260;
AH: 274–288; AA: `text()` helper, 101–130). **[src]**

### 1.3 Which field lands in which slot, per symbol category **[ran]**

Measured by rendering every option at once and dumping every `text` instruction.
`X/Y` means the fields are joined with `/` in that order when both are present.

**Land units (symbol sets 10, 11, 25, 27, 40 — `metadata.unit === true`)**
and **all letter-based (2525B/APP-6A) SIDCs**:

| slot | content | example frame (GroundFriend, `bbox=[25,50,175,150]`) |
|---|---|---|
| L1 | `W` | x=5 y=40 |
| L2 | `X` / `Y` | x=5 y=80 |
| L3 | `V` / `AD` / `AE` | x=5 y=120 |
| L4 | `T` | x=5 y=160 |
| L5 | `Z` | x=5 y=200 |
| R1 | `F` (or `AC` when `metadata.activity`) | x=195 y=40 |
| R2 | `G` | x=195 y=80 |
| R3 | `H` / `AF` | x=195 y=120 |
| R4 | `M` | x=195 y=160 |
| R5 | `J` / `K` / `L` / `N` / `P` | x=195 y=200 |
| above | `C` | x=100 y=40 |
| inside | `AA` | x=100 y=103 |
| below | `AH` | x=100 y=185 |

**Land equipment (set 15) and land installations (set 20)** — `metadata.unit === false`:

| slot | content |
|---|---|
| L1 | `W` |
| L2 | `X` / `Y` |
| L3 | `V` / `AD` / `AF` / `AI` |
| L4 | `T` |
| L5 | `Z` |
| R1 | `AC` |
| R2 | `G` |
| R3 | `H` / `AE` |
| R4 | `M` |
| R5 | `J` / `K` / `L` / `N` / `P` |

**Air and space (base dimension `Air`)** — left column is empty:

| slot | content | example (AirFriend, `bbox=[45,30,155,150]`) |
|---|---|---|
| R1 | `T` | x=175 y=40 |
| R2 | `P` | x=175 y=80 |
| R3 | `V` | x=175 y=120 |
| R4 | `Z` / `X` | x=175 y=160 |
| R5 | `G` / `H` | x=175 y=200 |
| above | `C` | x=100 y=20 |

**Sea surface (set 30):** L1 = `AQ`/`AR`; R1 = `T`; R2 = `V`; R3 = `P`;
R4 = `G`/`H`; R5 = `Y`/`Z`.

**Subsurface (set 35):** L1 = `AR`; R1 = `T`; R2 = `V`; R3 = `X`; R4 = `G`; R5 = `H`.

**Dismounted individual (set 27):** L1 = `W`; L2 = `X`/`Y`; L3 = `V`/`AD`/`AF`;
L4 = `T`; L5 = `Z`; R1 = `AC`; R2 = `G`; R3 = `H`; R4 = `M`;
R5 = `J`/`K`/`L`/`N`/`P`; **`C` is drawn below the frame**, not above.

> **Control measures (symbol set 25) bypass all of the above.** If the 6-digit
> entity code has an entry in `src/numbersidc/labels/tactical-points.js`,
> `textfields.js` takes an **early return** (lines 138–159) and draws *only* the
> per-symbol label overrides — each with its own hard-coded `x`, `y`, `fontsize`,
> `textanchor`. This is also the only place `targetNumber` (field AP) and the
> synthetic `uniqueDesignation1` / `dtg1` keys are used. **[src]**

### 1.4 Text-block styling knobs **[src]**

| style option | default | effect |
|---|---|---|
| `infoFields` | `true` | set `false` to suppress the whole text block *and* the direction arrow |
| `infoSize` | `40` | font size for all L/R rows; also drives the row pitch |
| `infoColor` | `""` | string or per-affiliation ColorMode; falls back to `colors.iconColor[affiliation]` |
| `fontfamily` | `"Arial"` | |
| `infoBackground` | `""` | draws a notched polygon behind each text column |
| `infoBackgroundFrame` | `""` | declared in `symbol.js` but `textfields.js` derives the stroke from `infoBackground` — setting `infoBackgroundFrame` alone has **no effect** **[src]** |
| `infoOutlineWidth` | `false` | `false` ⇒ inherit `outlineWidth` |
| `infoOutlineColor` | `"rgb(239, 239, 239)"` | |

---

## 2. Graphic amplifiers

All drawn by `src/symbolfunctions/modifier.js` unless stated otherwise.
Every geometry below is `fill: false`, `stroke: color`, `strokewidth: style.strokeWidth`
unless the snippet sets `fill` explicitly (`modifier.js:628-641`). **[src]**
`color = style.frameColor?.[affiliation] ?? colors.iconColor[affiliation]`.

`bbox` = `metadata.baseGeometry.bbox`, i.e. the frame box from §3.2.

### 2.1 Echelon / size (SIDC digits 9–10, values `11`–`26`) **[ran]**

Function `modifier()`, block `if (this.metadata.echelon)` (`modifier.js:212-449`).
`installationPadding = metadata.installation ? 15 : 0`; the whole group is wrapped in
`{type:"translate", x:0, y:-installationPadding}`.

| digits | `metadata.echelon` | Drawn geometry | resulting `gbbox.y1` |
|---|---|---|---|
| `11` | Team/Crew | `circle(100, y1-20, r15)` + `path M80,(y1-10) L120,(y1-30)` | `y1-40` |
| `12` | Squad | 1 filled `circle(100, y1-20, r7.5)` | `y1-27.5` |
| `13` | Section | 2 filled circles at x = 85, 115, `cy = y1-20`, r 7.5 | `y1-27.5` |
| `14` | Platoon/detachment | 3 filled circles at x = 70, 100, 130 | `y1-27.5` |
| `15` | Company/battery/troop | 1 vertical bar `M100,(y1-10) L100,(y1-35)` | `y1-40` |
| `16` | Battalion/squadron | 2 bars at x = 90, 110 | `y1-40` |
| `17` | Regiment/group | 3 bars at x = 80, 100, 120 | `y1-40` |
| `18` | Brigade | 1 X: `M87.5,(y1-10) l25,-25 m0,25 l-25,-25` | `y1-40` |
| `21` | Division | 2 X at x-origin 70, 105 | `y1-40`, x 70…130 |
| `22` | Corps/MEF | 3 X at 52.5, 87.5, 122.5 | `y1-40`, x 52.5…147.5 |
| `23` | Army | 4 X at 35, 70, 105, 140 | `y1-40`, x 35…165 |
| `24` | Army Group/front | 5 X at 17.5, 52.5, 87.5, 122.5, 157.5 | `y1-40`, x 17.5…182.5 |
| `25` | Region/Theater | 6 X at 0, 35, 70, 105, 140, 175 | `y1-40`, x 0…200 |
| `26` | Command | 2 crosses `M70,(y1-22.5) l25,0 m-12.5,12.5 l0,-25` and same at 105 | `y1-40`, x 70…130 |

Each X is a 25×25 cross whose top edge is at `y1-35` and bottom at `y1-10`.

Measured overall symbol heights (GroundFriend, size 100, strokeWidth 4): amp `00` →
108; `12/13/14` → 135.5; every other echelon → 148, except `24` (173 wide) and
`25` (208 wide). **[ran]**

The mapping table itself is `mapping.echelonMobility` in
`src/numbersidc/metadata.js:41-79`. **[src]**

> **Gotcha:** digits `19`, `20`, `27`–`30` and `00` all satisfy
> `echelonMobility <= 30`, so `metadata.echelon` becomes `undefined` and no
> amplifier is drawn. Value `30` *also* satisfies `>= 30`, so it sets
> `metadata.mobility = undefined`, which makes **`isValid()` return `false`**
> (`isvalid.js` tests `this.metadata.mobility != undefined`). Verified false for
> amps `30, 38, 39, 40, 43, 50, 53, 60, 63, 69`. **[ran]**

### 2.2 Mobility (SIDC digits 9–10, values `31`–`52`) **[ran]**

Block `if (this.metadata.mobility)` (`modifier.js:451-600`). The group is wrapped in
`{type:"translate", x:0, y: bbox.y2}` — so the path coordinates below are **relative to
the bottom of the frame**.

Neutral frames get a pre-shift first (`modifier.js:453-470`): `bbox.y2 += 8` for
Towed / Short towed array / Long towed array, `+= 18` for Over-snow / Sled, `+= 5` for Barge.

| digits | `metadata.mobility` | Appearance | Path / primitives (relative to `bbox.y2`) | height added |
|---|---|---|---|---|
| `31` | Wheeled limited cross country | axle line + 2 wheels | `M 53,1 l 94,0`; circles (58,8,r8), (142,8,r8) | +16 |
| `32` | Wheeled cross country | axle + 3 wheels | as `31` plus circle (100,8,r8) | +16 |
| `33` | Tracked | rounded capsule | `M 53,1 l 100,0 c15,0 15,15 0,15 l -100,0 c-15,0 -15,-15 0,-15` | +18, x 42…168 |
| `34` | Wheeled and tracked combination | 1 wheel + capsule | circle (58,8,r8); `M 83,1 l 70,0 c15,0 15,15 0,15 l -70,0 c-15,0 -15,-15 0,-15` | +16, x …168 |
| `35` | Towed | bar with a wheel at each end, raised | `M 63,1 l 74,0`; circles (58,3,r8), (142,3,r8) | +10 |
| `36` | Rail | axle + 4 wheels | `M 53,1 l 96,0`; circles at x = 58, 73, 127, 142 (cy 8, r 8) | +16 |
| `37` | Pack animals | zig-zag `W` | `M 80,20 l 10,-20 10,20 10,-20 10,20` | +20 |
| `41` | Over snow (prime mover) | ski tip | `M 50,-9 l10,10 90,0` | +9 |
| `42` | Sled | open capsule | `M 145,-12 c15,0 15,15 0,15 l -90,0 c-15,0 -15,-15 0,-15` | +15, x 42…168 |
| `51` | Barge | shallow hull | `M 50,1 l 100,0 c0,10 -100,10 -100,0` | +10 |
| `52` | Amphibious | wave line | `M 65,10 c 0,-10 10,-10 10,0 0,10 10,10 10,0 0,-10 10,-10 10,0 0,10 10,10 10,0 0,-10 10,-10 10,0 0,10 10,10 10,0 0,-10 10,-10 10,0` | +20 |
| `61` | Short towed array | line, square end-caps, 1 diamond | `M 50,5 l 100,0 M50,0 l10,0 0,10 -10,0 z M150,0 l-10,0 0,10 10,0 z M100,0 l5,5 -5,5 -5,-5 z` — **`fill: color`** | +10 |
| `62` | Long towed array | line, square end-caps, 1 square + 2 diamonds | `M 50,5 l 100,0 M50,0 l10,0 0,10 -10,0 z M150,0 l-10,0 0,10 10,0 z M105,0 l-10,0 0,10 10,0 z M75,0 l5,5 -5,5 -5,-5 z M125,0 l5,5 -5,5 -5,-5 z` — **`fill: color`** | +10 |

Measured symbol heights (GroundFriend, base 108): `31/32/34/36` → 124, `33` → 126,
`35/51/61/62` → 118, `37/52` → 128, `41` → 117, `42` → 123. **[ran]**

> **Not implemented:** APP-6 mobility code for a **half-track** has no distinct
> milsymbol entry; `34` ("Wheeled and tracked combination") is the nearest. The
> half-track appearance (one wheel + one track) *is* what `34` draws. **[src]**

### 2.3 Towed array (digits `61`, `62`)

Handled by the same `mobilities` table — see above. milsymbol classifies them under
`metadata.mobility`, not a separate field (`metadata.js:233-235` puts `30 ≤ n < 70`
into `mobility`). **[src]**

### 2.4 Dismounted leadership (digits `71`, `72`) **[ran]**

`modifier.js:602-620`. Sets `metadata.leadership`.

* `71` → `"Leader Individual"`, `72` → `"Deputy Individual"`.
* Geometry exists **only for affiliation `Friend`**: `path "m 45,60 55,-25 55,25"`
  (a chevron over the frame). Neutral / Hostile / Unknown variants are commented out
  in the source, so **nothing is drawn** for those affiliations. **[src]**
* The dashed rendering that should distinguish *Deputy* from *Leader* is commented out
  (`modifier.js:614-615`) — **`71` and `72` render identically**. **[src]**
* It is pushed into `drawArray1` (the "pre" array), so it is painted **behind** the frame.
* `gbbox.y1 = bbox.y1 - 20`; measured height 128 vs. base 108. **[ran]**

### 2.5 Headquarters staff (SIDC digit 8 ∈ {2,3,6,7}) **[ran]**

`modifier.js:13-64`. Length = `style.hqStaffLength || ms._hqStaffLength` (default **100**).

```
path  M<bbox.x1>,<y> L<bbox.x1>,<bbox.y2 + hqStaffLength>
```
where `y = bbox.y2` for geometries `AirFriend, AirNeutral, GroundFriend, GroundNeutral,
SeaNeutral, SubsurfaceNeutral`, otherwise `y = 100`.

Measured, GroundFriend: `M25,150 L25,250`; symbol height 108 → 208. **[ran]**

**The HQ staff moves `getAnchor()`** to the foot of the staff:
`anchor = { x: bbox.x1, y: bbox.y2 + hqStaffLength }` (`setoptions.js:89-95`). For a
plain friend infantry HQ, `getAnchor()` = `{x:4, y:204}` while `getOctagonAnchor()`
stays `{x:79, y:54}`. **[ran]**

### 2.6 Task force bracket (SIDC digit 8 ∈ {4,5,6,7}) **[ran]**

`modifier.js:66-108`. Width depends on echelon:

| echelon | width |
|---|---|
| Corps/MEF | 110 |
| Army | 145 |
| Army Group/front | 180 |
| Region/Theater | 215 |
| everything else | 90 |

```
path  M<100-w/2>,<bbox.y1> L<100-w/2>,<bbox.y1-40> <100+w/2>,<bbox.y1-40> <100+w/2>,<bbox.y1>
```
Measured GroundFriend default: `M55,50 L55,10 145,10 145,50`; at Corps:
`M45,50 L45,10 155,10 155,50`. **[ran]**

### 2.7 Feint / dummy (SIDC digit 8 ∈ {1,3,5,7}) **[ran]**

`modifier.js:170-210`. A dashed inverted V whose apex is
`topPoint = bbox.y1 - bbox.width()/2`:

```
path  M100,<topPoint> L<bbox.x1>,<bbox.y1>  M100,<topPoint> L<bbox.x2>,<bbox.y1>
stroke-dasharray = ms._dashArrays.feintDummy = "8,8"
```
Measured GroundFriend (`bbox.width()=150`): `M100,-25 L25,50 M100,-25 L175,50`,
`stroke-dasharray="8,8"`, `stroke-width="4"`, `fill="none"`. **[ran]**

Digit-8 decode (`metadata.js:216-223`): **[ran]**

| digit 8 | feintDummy | headquarters | taskForce |
|---|---|---|---|
| 0 | – | – | – |
| 1 | ✔ | – | – |
| 2 | – | ✔ | – |
| 3 | ✔ | ✔ | – |
| 4 | – | – | ✔ |
| 5 | ✔ | – | ✔ |
| 6 | – | ✔ | ✔ |
| 7 | ✔ | ✔ | ✔ |

> **Source bug:** `getmetadata.js:24` initialises the property as `fenintDummy` (typo)
> while `numbersidc/metadata.js:217` writes `feintDummy`. Therefore
> `metadata.feintDummy` is `undefined` (not `false`) when the flag is off. Use a
> truthiness test, never `=== false`. **[ran]**

### 2.8 Offset location indicator

Field **S**. In milsymbol this is the **same HQ staff line** (§2.5) — there is no
separate offset-location amplifier and no option to draw a staff on a non-HQ symbol.
The only lever is `style.hqStaffLength`. **[src]**

### 2.9 Installation flag (symbol set 20, or frame-shape override `5`) **[ran]**

`modifier.js:110-168`. A small rectangle notched at the bottom centre, sitting on top of
the frame, **filled with the frame colour**:

```
gapFiller = 14  for AirHostile / GroundHostile / SeaHostile
          =  2  for AirUnknown / GroundUnknown / SeaUnknown / AirFriend / SeaFriend
          =  0  otherwise
path  M85,<y1+gapFiller-sw/2>  85,<y1-10>  115,<y1-10>  115,<y1+gapFiller-sw/2>  100,<y1-sw>  Z
```
Measured (`strokeWidth = 4`): **[ran]**

| frame | rendered `d` |
|---|---|
| GroundFriend (`y1=50`) | `M85,48 85,40 115,40 115,48 100,46 Z` |
| GroundNeutral (`y1=45`) | `M85,43 85,35 115,35 115,43 100,41 Z` |
| GroundUnknown (`y1=30.75`) | `M85,30.75 85,20.75 115,20.75 115,30.75 100,26.75 Z` |
| GroundHostile (`y1=28`) | `M85,40 85,18 115,18 115,40 100,24 Z` |

When an installation also carries an echelon, the echelon group is shifted up by
`translate(0,-15)`. **[ran]**

### 2.10 Condition / operational-capacity bar (SIDC digit 7 ∈ {2,3,4,5}) **[ran]**

`src/symbolfunctions/statusmodifier.js`.

**Full (default) rendering** — requires `metadata.fill === true`, `style.monoColor === ""`
and `style.simpleStatusModifier === false`:

```
y2 = bbox.y2
   + (options.headquartersElement ? 35 : 0)
   + (metadata.mobility ? 25 : 5)
path  M<bbox.x1>,<y2> l<bbox.width()>,0 0,25 -<bbox.width()>,0 z
stroke = colors.frameColor[affiliation]   stroke-width = style.strokeWidth
```

| digit 7 | `metadata.condition` | bar fill |
|---|---|---|
| `2` | `FullyCapable` | `rgb(0,255,0)` |
| `3` | `Damaged` | `rgb(255,255,0)` |
| `4` | `Destroyed` | `rgb(255,0,0)` |
| `5` | `FullToCapacity` | `rgb(0, 180, 240)` |

Measured GroundFriend (`bbox=[25,50,175,150]`): `M25,155 l150,0 0,25 -150,0 z` — bar
occupies y 155…180, total symbol height 138 (vs 108). SeaFriend (`bbox.y2=160`) with a
mobility amplifier: `M40,165 l120,0 0,25 -120,0 z`. **[ran]**

**Simple rendering** — used when the symbol is unfilled, monochrome, or
`simpleStatusModifier: true`:

* `Damaged` → `path M150,20 L50,180`, `stroke-width = 2 × strokeWidth` (= 8)
* `Destroyed` → the above **plus** `path M50,20 L150,180`
* `FullyCapable` / `FullToCapacity` → **nothing is drawn**
* bbox becomes `y1=20, y2=180`. **[ran]**

### 2.11 Engagement bar (field AO) **[ran]**

`src/symbolfunctions/engagmentbar.js`. Driven purely by options, not by the SIDC.
It runs **after** `modifier` and `statusmodifier`, and reads `this.bbox` (the accumulated
symbol box), so it always sits above the echelon / task-force / feint amplifiers.

```
width = max(this.bbox.width(), engagementBar.length * 16)
bar   : M<100-w/2>,<this.bbox.y1 - 6> l<w>,0 0,-25 -<w>,0 z
text  : x=100 y=<this.bbox.y1 - 11> anchor=middle bold size=22
stroke = colors.frameColor[affiliation]
```
Fill (only when `metadata.fill && monoColor === ""`), keyed on
`options.engagementType.toUpperCase()`:

| `engagementType` | bar fill |
|---|---|
| `TARGET` | `rgb(255, 0, 0)` |
| `NON-TARGET` | `rgb(255, 255, 255)` |
| `EXPIRED` | `rgb(255, 120, 0)` |
| anything else / unset | `colors.fillColor[affiliation]` |

Measured, plain friend infantry, `engagementBar:"2:6:1"`, `engagementType:"TARGET"`:
`<path d="M25,44 l150,0 0,-25 -150,0 z" stroke-width="4" stroke="black" fill="rgb(255, 0, 0)">`
and `<text x="100" y="39" … font-size="22" font-weight="bold">2:6:1</text>`.
With a Company echelon already present (`this.bbox.y1 = 10`) the bar moves to
`M25,4 l150,0 0,-25 -150,0 z` and the text to `y=-1`. **[ran]**

### 2.12 Direction of movement / speed leader (field Q) **[ran]**

`src/symbolfunctions/directionarrow.js`. Requires `style.infoFields !== false`
and `options.direction` to be defined and non-empty.

* **`speedLeader === 0` (default)** — a movement arrow of length `95`, rotated by
  `direction` degrees about `(100,100)`:
  `path "M100,100 l0,-75 -5,3 5,-15 5,15 -5,-3"` inside
  `{type:"rotate", degree: direction, x:100, y:100}`.
  For **Ground** (and dimension-less) symbols the arrow is translated down to
  `bbox.y2` and a 100-unit stem `M100,<bbox.y2> l0,100` is added; for **headquarters**
  the arrow is instead translated to the foot of the HQ staff
  (`x: bbox.x1-100`, `y: bbox.y2 - (100 - hqStaffLength)`).
* **`speedLeader > 0`** — a plain line of length `speedLeader * (100 / style.size)`
  from `(100,100)` at the given bearing, drawn in the "pre" array (behind the symbol).

### 2.13 Stacked symbols (`options.stack`) **[ran]**

`src/symbolfunctions/stack-extension.js` draws `stack` extra copies of the frame behind
the main one, offset by `translate(15*i, 9*i)` for `i = stack … 1`. Verified with
`stack: 3`: three `<g transform="translate(45,27)">`, `translate(30,18)`,
`translate(15,9)` groups. Every right-column text field is additionally pushed right by
`stack * 15`.

---

## 3. Drawing coordinate system

### 3.1 The 100×100 "L" box and the octagon **[ran]**

* All internal geometry is expressed in a fixed **0…200** coordinate space with the
  symbol centre at **(100, 100)**. The SVG `viewBox` is always emitted in this space;
  only the `width`/`height` attributes are scaled by `style.size`.
* `style.size` **is the "L" value** — the width of the icon octagon, default **100**.
  The scale factor applied to width/height is `size / 100`.
* The **icon octagon** (`src/symbolfunctions/debug.js`, exposed via `ms.showOctagon()`)
  is exactly:

```
M 100,50  135.35534,64.64466  150,100  135.35534,135.35534
  100,150.00002  64.644661,135.35534  50,100  64.644661,64.64466  z
```
plus the internal guides `m 120,60 0,80 m -40,-80 0,80 m -20,-20 80,0 m 0,-40 -80,0`
(vertical lines at x = 80 and 120 spanning y 60…140, horizontal lines at y = 80 and 120
spanning x 60…140). So the octagon inscribes the square **50 ≤ x,y ≤ 150** with corners
chamfered at `100 ± 50/√2 = 64.6447 / 135.3553`.

* The **default icon bounding box** in `icon.js:5` is
  `new ms.BBox({x1:50, x2:150, y1:50, y2:150})` — i.e. the octagon's square. Individual
  icons may override it via the per-symbol-set `bbox` table (e.g. control-measure
  `130100` uses `{x1:60, x2:140, y1:-60}`). **[src]**

### 3.2 Frame bounding boxes, per dimension × affiliation **[ran]**

Dumped verbatim from `ms._symbolGeometries` (`src/ms/symbolgeometries.js`).

| key | primitive | `d` / params | x1 | y1 | x2 | y2 | w | h |
|---|---|---|---|---|---|---|---|---|
| AirHostile | path | `M 45,150 L45,70 100,20 155,70 155,150` | 45 | 20 | 155 | 150 | 110 | 130 |
| AirFriend | path | `M 155,150 C 155,50 115,30 100,30 85,30 45,50 45,150` | 45 | 30 | 155 | 150 | 110 | 120 |
| AirNeutral | path | `M 45,150 L 45,30,155,30,155,150` | 45 | 30 | 155 | 150 | 110 | 120 |
| AirUnknown | path | `M 65,150 c -55,0 -50,-90 0,-90 0,-50 70,-50 70,0 50,0 55,90 0,90` | 25 | 20 | 175 | 150 | 150 | 130 |
| GroundHostile | path | `M 100,28 L172,100 100,172 28,100 100,28 Z` | 28 | 28 | 172 | 172 | 144 | 144 |
| GroundFriend | path | `M25,50 l150,0 0,100 -150,0 z` | 25 | 50 | 175 | 150 | 150 | 100 |
| GroundNeutral | path | `M45,45 l110,0 0,110 -110,0 z` | 45 | 45 | 155 | 155 | 110 | 110 |
| GroundUnknown | path | `M63,63 C63,20 137,20 137,63 C180,63 180,137 137,137 C137,180 63,180 63,137 C20,137 20,63 63,63 Z` | 30.75 | 30.75 | 169.25 | 169.25 | 138.5 | 138.5 |
| LandDismountedIndividualHostile | path | `M 100,28 L172,100 100,172 28,100 100,28 Z` | 28 | 28 | 172 | 172 | 144 | 144 |
| LandDismountedIndividualFriend | path | `m 100,45 55,25 0,60 -55,25 -55,-25 0,-60 z` | 45 | 45 | 155 | 155 | 110 | 110 |
| LandDismountedIndividualNeutral | path | `M45,45 l110,0 0,110 -110,0 z` | 45 | 45 | 155 | 155 | 110 | 110 |
| LandDismountedIndividualUnknown | path | (same as GroundUnknown) | 30.75 | 30.75 | 169.25 | 169.25 | 138.5 | 138.5 |
| SeaHostile | path | `M100,28 L172,100 100,172 28,100 100,28 Z` | 28 | 28 | 172 | 172 | 144 | 144 |
| SeaFriend | circle | `cx=100 cy=100 r=60` | 40 | 40 | 160 | 160 | 120 | 120 |
| SeaNeutral | path | `M45,45 l110,0 0,110 -110,0 z` | 45 | 45 | 155 | 155 | 110 | 110 |
| SeaUnknown | path | (same as GroundUnknown) | 30.75 | 30.75 | 169.25 | 169.25 | 138.5 | 138.5 |
| SubsurfaceHostile | path | `M45,50 L45,130 100,180 155,130 155,50` | 45 | 50 | 155 | 180 | 110 | 130 |
| SubsurfaceFriend | path | `m 45,50 c 0,100 40,120 55,120 15,0 55,-20 55,-120` | 45 | 50 | 155 | 170 | 110 | 120 |
| SubsurfaceNeutral | path | `M45,50 L45,170 155,170 155,50` | 45 | 50 | 155 | 170 | 110 | 120 |
| SubsurfaceUnknown | path | `m 65,50 c -55,0 -50,90 0,90 0,50 70,50 70,0 50,0 55,-90 0,-90` | 25 | 50 | 175 | 180 | 150 | 130 |
| PositionMarker | circle | `cx=100 cy=100 r=15` | 85 | 85 | 115 | 115 | 30 | 30 |

**Frame selection** is `ms._symbolGeometries[metadata.dimension + metadata.affiliation]`
(`getmetadata.js:118-127`). If `style.frame === false && style.icon === false`, the frame
becomes `PositionMarker`. **[src]**

**Symbol-set → dimension** (`metadata.js:35-56`), and the redirections that matter: **[ran]**

| symbol set | `metadata.dimension` |
|---|---|
| `00` | *(none)* — `dimensionUnknown = true`, draws a bold `?` at (100,127) size 80 |
| `01`,`02`,`05`,`06`,`50`,`51` | `Air` (`05`,`06`,`50` also set `space`) |
| `10`,`11`,`12`,`20`,`40`,`52`,`60` | `Ground` |
| `15` | **`Sea`** — land equipment uses the sea-surface frame |
| `52` | **`Sea`** — SIGINT ground uses the sea-surface frame |
| `27` | `LandDismountedIndividual` |
| `30`,`53`,`00` | `Sea` |
| `35`,`36`,`39`,`54` | `Subsurface` |
| `25` (control measures) | `""` — **no frame at all** |

### 3.3 `getSize()`, `getAnchor()`, `getOctagonAnchor()` **[ran]**

From `src/ms/symbol/setoptions.js:70-135`, with
`sw = Number(style.strokeWidth)` (default **4**), `ow = Number(style.outlineWidth)`
(default **0**), `k = style.size / 100`, and `bbox` = the accumulated symbol bbox
(frame + all amplifiers + text + padding):

```
baseWidth  = bbox.width()  + 2*sw + 2*ow
baseHeight = bbox.height() + 2*sw + 2*ow
getSize()  = { width:  baseWidth  * k,
               height: baseHeight * k }

octagonAnchor = { x: (100 - bbox.x1 + sw + ow) * k,
                  y: (100 - bbox.y1 + sw + ow) * k }     // symbol centre, in output px

anchor        = octagonAnchor                             // normally
anchor        = { x: (bbox_frame.x1 - bbox.x1 + sw + ow) * k,
                  y: (bbox_frame.y2 + hqStaffLength - bbox.y1 + sw + ow) * k }
                                                          // when metadata.headquarters

asSVG(): width  = getSize().width
         height = getSize().height
         viewBox = "<bbox.x1 - sw - ow> <bbox.y1 - sw - ow> <baseWidth> <baseHeight>"
```

Verified numerically: **[ran]**

| case | bbox | getSize() | getAnchor() | getOctagonAnchor() | viewBox |
|---|---|---|---|---|---|
| friend infantry, defaults | `[25,50,175,150]` | 158 × 108 | 79, 54 | 79, 54 | `21 46 158 108` |
| same, `size: 35` | `[25,50,175,150]` | 55.3 × 37.8 | 27.65, 18.9 | 27.65, 18.9 | `21 46 158 108` |
| same, `outlineWidth: 3` | `[25,50,175,150]` | 164 × 114 | 82, 57 | 82, 57 | `18 43 164 114` |
| same, `padding: 20` | `[5,30,195,170]` | 198 × 148 | 99, 74 | 99, 74 | `1 26 198 148` |
| same, `square: true` | `[25,25,175,175]` | 158 × 158 | 79, 79 | **79, 54** ⚠️ | `21 21 158 158` |
| HQ (digit 8 = 2) | `[25,50,175,250]` | 158 × 208 | **4, 204** | 79, 54 | `21 46 158 208` |
| `frame:false, icon:false` | `[85,85,115,115]` | 38 × 38 | 19, 19 | 19, 19 | `81 81 38 38` |

> ⚠️ **Source bug:** `octagonAnchor` is computed **before** the `style.square` block
> (`setoptions.js:70-108`), so with `square: true` it is stale. With `square: true`,
> compute the octagon anchor yourself as `getSize().width / 2`. **[ran]**

**Practical consequence for Figma:** the SVG string from `asSVG()` is already
self-describing — `width`/`height` in output px, `viewBox` in internal units. Import it
with `figma.createNodeFromSvg(sym.asSVG())` and it lands at the right pixel size. To
place a symbol at a map point, offset the node by `-getAnchor().x, -getAnchor().y`.

### 3.4 Draw order **[ran]**

`ms.getSymbolParts().map(f => f.name)` returns:

```
stack, basegeometry, icon, modifier, statusmodifier,
engagement, affliationdimension, textfieldsMod, directionarrow
```

Each part returns `{pre, post, bbox}`; `pre` is **prepended** (painted first/behind) and
`post` is **appended** (painted last/on top), and `this.bbox` is merged after each part
(`setoptions.js:33-67`). That is why the engagement bar sits above the echelon: it reads
`this.bbox` *after* `modifier` has already grown it.

### 3.5 Outlines **[src]**

`ms.outline(geom, outlineWidth, strokeWidth, color)` (`src/ms/outline.js`) clones the
geometry, drops `fill`/`fillopacity`, sets
`strokewidth = (own strokewidth || strokeWidth) + 2*outlineWidth`, `stroke = color`,
`fill = false`, `linecap = "round"`, and the clone is pushed into the part's `pre`
array — i.e. a fattened copy painted behind. Default `outlineColor` is
`rgb(239, 239, 239)`, default `outlineWidth` is `0` (off).

---

## 4. Colours

### 4.1 Registered colour modes — exact values **[ran]**

Dumped from `ms.getColorMode(name)`; source `src/colormodes.js`.

| mode | Friend | Hostile | Neutral | Unknown | Civilian | Suspect |
|---|---|---|---|---|---|---|
| **Light** | `rgb(128,224,255)` `#80E0FF` | `rgb(255,128,128)` `#FF8080` | `rgb(170,255,170)` `#AAFFAA` | `rgb(255,255,128)` `#FFFF80` | `rgb(255,161,255)` `#FFA1FF` | `rgb(255, 229, 153)` `#FFE599` |
| **Medium** | `rgb(0,168,220)` `#00A8DC` | `rgb(255,48,49)` `#FF3031` | `rgb(0,226,110)` `#00E26E` | `rgb(255,255,0)` `#FFFF00` | `rgb(128,0,128)` `#800080` | `rgb(255, 217, 107)` `#FFD96B` |
| **Dark** | `rgb(0,107,140)` `#006B8C` | `rgb(200,0,0)` `#C80000` | `rgb(0,160,0)` `#00A000` | `rgb(225,220,0)` `#E1DC00` | `rgb(80,0,80)` `#500050` | `rgb(255, 188, 1)` `#FFBC01` |
| **FrameColor** | `rgb(0, 255, 255)` `#00FFFF` | `rgb(255, 0, 0)` `#FF0000` | `rgb(0, 255, 0)` `#00FF00` | `rgb(255, 255, 0)` `#FFFF00` | `rgb(255,0,255)` `#FF00FF` | **`rbg(255, 188, 1)`** ⚠️ |
| **IconColor** | `rgb(0, 255, 255)` | `rgb(255, 0, 0)` | `rgb(0, 255, 0)` | `rgb(255, 255, 0)` | `rgb(255,0,255)` | `rgb(255, 188, 1)` |
| **Black** | `black` ×6 | | | | | |
| **White** | `white` ×6 | | | | | |
| **OffWhite** | `rgb(239, 239, 239)` ×6 `#EFEFEF` | | | | | |
| **None** | `false` ×6 (transparent) | | | | | |

> ⚠️ **Source bug, `src/colormodes.js:30`:** `FrameColor.Suspect` is spelled
> `"rbg(255, 188, 1)"` — an invalid CSS colour. It leaks into the SVG for any
> **unfilled suspect** symbol: rendering `1305 10 …` with `{fill:false}` emits
> `stroke="rbg(255, 188, 1)"`, which browsers and Figma will drop to black.
> **Workaround:** register a corrected mode at start-up —
> `ms.setColorMode("FrameColor", {...ms.getColorMode("FrameColor"), Suspect: "rgb(255,188,1)"})`. **[ran]**

The Suspect entry is new in the E editions (milsymbol 3.0.0 changelog: *"ColorModes now
includes a property 'Suspect' for the new colors introduced in 2525E"*). **[pub]**

### 4.2 Filled vs unfilled rules **[ran]**

`src/ms/symbol/getcolors.js`.

**Filled** (`metadata.fill === true`, the default):
* frame **fill** = `colorMode[affiliation]` (Light/Medium/Dark table above)
* frame **stroke** = `black`
* icon stroke/fill = `black`; icon "white" parts = **OffWhite** `rgb(239,239,239)`

Measured (`Light`, land-unit infantry): **[ran]**

| SIDC digit 4 | affiliation shown | frame fill | frame stroke | dash |
|---|---|---|---|---|
| `0` Pending | Unknown | `rgb(255,255,128)` | `black` | `4,4` |
| `1` Unknown | Unknown | `rgb(255,255,128)` | `black` | — |
| `2` Assumed friend | Friend | `rgb(128,224,255)` | `black` | `4,4` |
| `3` Friend | Friend | `rgb(128,224,255)` | `black` | — |
| `4` Neutral | Neutral | `rgb(170,255,170)` | `black` | — |
| `5` Suspect | Hostile shape | `rgb(255, 229, 153)` | `black` | `4,4` |
| `6` Hostile | Hostile | `rgb(255,128,128)` | `black` | — |

**Unfilled** (`style.fill = false`, or `metadata.fill === false`):
* frame **fill** = `none`
* frame **stroke** = `FrameColor[affiliation]` — the saturated colours
  (`rgb(0,255,255)` friend, `rgb(255,0,0)` hostile, `rgb(0,255,0)` neutral,
  `rgb(255,255,0)` unknown). Verified. **[ran]**
* icon colour = the same FrameColor.

**Monochrome** (`style.monoColor = "<css colour>"`):
* `getmetadata.js:95` forces `metadata.fill = false`
* every frame/icon colour becomes `monoColor`; fill becomes `none`
* the condition bar falls back to the **simple** diagonal-slash rendering (§2.10)
* the "not present" dash is applied **directly to the frame stroke**, not as an overlay
  (see §5.2). Verified: `<path … stroke-width="4" stroke-dasharray="4,4" stroke="black"
  fill="none">`. **[ran]**

**Civilian purple** (`style.civilianColor`, default `true`):
* When `metadata.civilian` is true, `Friend`, `Neutral` and `Unknown` all take the
  `Civilian` colour in `fillColor`, `frameColor` **and** `iconColor`.
* `metadata.civilian` is set for: symbol set `11` (all), `01`/`05`/`12` entity prefix
  `12`, `15` entity prefix `16`, `30` entity prefix `14`, `35` entity prefix `12`
  (`metadata.js:170-181`). **[src]**
* Verified: set 11 civilian individual renders `fill="rgb(255,161,255)"` with
  `civilianColor: true`, and `fill="rgb(128,224,255)"` with `civilianColor: false`.
  Air civilian `01 / 120100` also renders purple. **[ran]**

**Joker / Faker** (`metadata.js:153-160`): context = Exercise (digit 3 = `1`) with
digit 4 = `5` (joker) or `6` (faker) → drawn with the **Friend shape** but **Hostile
colours**, and an `X` / `J` / `K` glyph placed beside the frame by
`affliationdimension.js`. Verified `joker: true` / `faker: true` only for digit 3 = `1`. **[ran]**

> ⚠️ **Mutation hazard:** if you pass `colorMode` as an **object** rather than a mode
> name, `getcolors.js:3-5` assigns it by reference and then mutates it in place for
> civilian / joker / suspect symbols. Always pass a fresh clone, or a registered mode
> name string. **[src]**

### 4.3 Public cross-check **[pub] / [unverified]**

The Light/Medium/Dark triples above match the values milsymbol has shipped since the
2525C era and are what every milsymbol-based renderer produces. I was **not** able to
retrieve the normative APP-6E / 2525E colour table (Table 1 of the standard) in this
session, so the claim "these are the exact standard values" is **[unverified]**; what is
verified is that these are the exact values milsymbol 3.0.4 emits.

---

## 5. When the frame is dashed

### 5.1 Trigger conditions **[ran]**

`src/numbersidc/metadata.js:130-150` sets `metadata.notpresent` to a dash-array string:

| condition | SIDC | dash array | constant |
|---|---|---|---|
| Status = Planned / Anticipated | digit 7 = `1` | **`8,12`** | `ms._dashArrays.anticipated` |
| Standard identity = **Pending** | digit 4 = `0` | **`4,4`** | `ms._dashArrays.pending` |
| Standard identity = **Assumed friend** | digit 4 = `2` | **`4,4`** | `pending` |
| Standard identity = **Suspect / Joker** | digit 4 = `5` | **`4,4`** | `pending` |
| Sea-surface **manual track** | set `30`, entity `160000` | **`4,4`** | `pending` |
| Subsurface **ETC / POSCON** | set `35`, entity `140000` | **`4,4`** | `pending` |
| Subsurface **fused track** | set `35`, entity `150000` | **`4,4`** | `pending` |
| **Feint / dummy** chevron | digit 8 ∈ {1,3,5,7} | **`8,8`** | `ms._dashArrays.feintDummy` |

Note the digit-4 test runs **after** the status test, so a symbol that is both Pending
and Planned ends up with `4,4`, not `8,12`. **[src]**

Defaults confirmed at runtime: `ms.getDashArrays()` →
`{"pending":"4,4","anticipated":"8,12","feintDummy":"8,8"}`. **[ran]**
Override globally with `ms.setDashArrays(pending, anticipated, feintDummy)`.

### 5.2 How the dash is actually painted — two different mechanisms **[ran]**

This is the single most important rendering detail to replicate in Figma.

**(a) Filled symbols** (`style.fill && style.frame && metadata.notpresent && !metadata.unframed`,
`basegeometry.js:187-211`): the frame is drawn **solid** first, then a **second copy** of
the same path is overlaid with

```
fill            = false
stroke          = colors.white[affiliation]      // = rgb(239,239,239) when filled
stroke-width    = Number(style.strokeWidth) + 1  // = 5 by default
stroke-dasharray = metadata.notpresent
```

i.e. the "dashes" are **off-white segments painted over a solid black outline**, not a
dashed stroke. Verified output for a Pending land unit:

```xml
<path d="M63,63 C63,20 …Z" stroke-width="4" stroke="black" fill="rgb(255,255,128)" fill-opacity="1"></path>
<path d="M63,63 C63,20 …Z" stroke-width="5" stroke-dasharray="4,4" stroke="rgb(239, 239, 239)" fill="none"></path>
```

and for a Planned friend land unit:

```xml
<path d="M25,50 l150,0 0,100 -150,0 z" stroke-width="4" stroke="black" fill="rgb(128,224,255)" fill-opacity="1"></path>
<path d="M25,50 l150,0 0,100 -150,0 z" stroke-width="5" stroke-dasharray="8,12" stroke="rgb(239, 239, 239)" fill="none"></path>
```

**(b) Unfilled or monochrome symbols** (`(style.monoColor != "" || !style.fill) && metadata.notpresent`,
`basegeometry.js:63-67`): the dash array is applied **directly** to the single frame path.
Verified with `{monoColor:"black", fill:false}`:

```xml
<path d="M63,63 …Z" stroke-width="4" stroke-dasharray="4,4" stroke="black" fill="none" fill-opacity="1"></path>
```

**Figma note:** mechanism (a) produces two stacked vector nodes. If you flatten or
recolour the import, keep both, and keep the overlay **above** the frame.

### 5.3 What is *not* dashed

The **feint/dummy** amplifier is a separate chevron above the frame (§2.7); the frame
itself stays solid unless one of the §5.1 conditions also applies. The **task-force
bracket**, **HQ staff**, **echelon** and **mobility** amplifiers are never dashed.
`metadata.leadership === "Deputy Individual"` *should* be dashed per the standard, but
that line is commented out in milsymbol (§2.4). **[src]**

---

## 6. Recommended preset symbols

All 33 below were verified by running milsymbol 3.0.4 (`research/scratch/08-presets.mjs`,
input `research/scratch/presets-final.json`). The check asserts, for each SIDC:

1. `sidc.length === 30`
2. `sym.isValid() === true`
3. at least one draw instruction **other than** the frame path exists (⇒ a real icon,
   not a bare frame)
4. the "undefined icon" question-mark path (`m 94.8206,78.1372 …`) is **absent**

Result: **33 / 33 OK**. **[ran]**

Human labels come from the `milstandard-e` TSV entity tables
(`node_modules/milstandard-e/tsv-tables/*.tsv`), cross-referenced against the entity
codes milsymbol actually has icons for (`research/scratch/07-catalog.mjs`). **[src]**

All use version `13` (MIL-STD-2525E). For APP-6E, swap digits 1–2 to `14` — but read
the warning in §7 first.

| # | Label | SIDC (30 digits) | set | entity | amplifier |
|---|---|---|---|---|---|
| 1 | Infantry company (friend) | `130310001512110000000000000000` | 10 | 121100 | echelon 15 |
| 2 | Armoured / mechanized battalion (friend) | `130310001612050000000000000000` | 10 | 120500 | echelon 16 |
| 3 | Field artillery platoon (friend) | `130310001413030000000000000000` | 10 | 130300 | echelon 14 |
| 4 | Reconnaissance / cavalry platoon (friend) | `130310001412130000000000000000` | 10 | 121300 | echelon 14 |
| 5 | Engineer brigade (friend) | `130310001814070000000000000000` | 10 | 140700 | echelon 18 |
| 6 | Medical company (friend) | `130310001516130000000000000000` | 10 | 161300 | echelon 15 |
| 7 | Air defence battery (friend) | `130310001513010000000000000000` | 10 | 130100 | echelon 15 |
| 8 | Special forces company (friend) | `130310001512170000000000000000` | 10 | 121700 | echelon 15 |
| 9 | Command and control battalion HQ (friend) | `130310021611000000000000000000` | 10 | 110000 | HQ + echelon 16 |
| 10 | Signal company (friend) | `130310001511100000000000000000` | 10 | 111000 | echelon 15 |
| 11 | Infantry company (hostile) | `130610001512110000000000000000` | 10 | 121100 | echelon 15 |
| 12 | Armoured battalion (hostile) | `130610001612050000000000000000` | 10 | 120500 | echelon 16 |
| 13 | Infantry company (unknown) | `130110001512110000000000000000` | 10 | 121100 | echelon 15 |
| 14 | All-classes supply company (neutral) | `130410001516020000000000000000` | 10 | 160200 | echelon 15 |
| 15 | Medium tank, tracked (friend) | `130315003312020000000000000000` | 15 | 120202 | mobility 33 |
| 16 | Armoured personnel carrier, wheeled cross-country (friend) | `130315003212010300000000000000` | 15 | 120103 | mobility 32 |
| 17 | Medium howitzer, towed (friend) | `130315003511090200000000000000` | 15 | 110902 | mobility 35 |
| 18 | Air defence missile launcher (friend) | `130315000011110000000000000000` | 15 | 111100 | — |
| 19 | Fighter, fixed wing (friend) | `130301000011010400000000000000` | 01 | 110104 | — |
| 20 | Rotary wing aircraft (friend) | `130301000011020000000000000000` | 01 | 110200 | — |
| 21 | Unmanned aerial vehicle (hostile) | `130601000011030000000000000000` | 01 | 110300 | — |
| 22 | Satellite (friend) | `130305000011070000000000000000` | 05 | 110700 | — |
| 23 | Aircraft carrier (friend) | `130330000012010000000000000000` | 30 | 120100 | — |
| 24 | Destroyer (friend) | `130330000012020300000000000000` | 30 | 120203 | — |
| 25 | Submarine (friend) | `130335000011010000000000000000` | 35 | 110100 | — |
| 26 | Ammunition cache (friend installation) | `130320000011030000000000000000` | 20 | 110300 | — |
| 27 | Medical treatment facility / hospital (friend installation) | `130320000012070200000000000000` | 20 | 120702 | — |
| 28 | Dismounted infantry individual (friend) | `130327000011021500000000000000` | 27 | 110215 | — |
| 29 | IED event (hostile activity) | `130640000011030000000000000000` | 40 | 110300 | — |
| 30 | Cyberspace unit (hostile) | `130660000011000000000000000000` | 60 | 110000 | — |
| 31 | Civilian individual (friend, renders purple) | `130311000011030000000000000000` | 11 | 110300 | — |
| 32 | Checkpoint (control measure point, unframed) | `130325000013030000000000000000` | 25 | 130300 | — |
| 33 | Action point (control measure point, unframed) | `130325000013010000000000000000` | 25 | 130100 | — |

If you need exactly 25, drop #10, #13, #14, #18, #21, #30, #33 — the remainder still
covers all ten symbol sets.

### Re-running the verification

```bash
cd .
node research/scratch/08-presets.mjs "$(cat research/scratch/presets-final.json)"
```

### Icon inventory per symbol set (milsymbol 3.0.4) **[ran]**

| set | main icons | sector-1 modifiers | sector-2 modifiers |
|---|---|---|---|
| 01 Air | 53 | 108 | 38 |
| 02 Air missile | 1 | 76 | 42 |
| 05 Space | 36 | 74 | 38 |
| 06 Space missile | 1 | 71 | 41 |
| 10 Land unit | 219 | 166 | 111 |
| 11 Land civilian | 11 | 93 | 28 |
| 15 Land equipment | 229 | 91 | 35 |
| 20 Land installation | 131 | 83 | 36 |
| 25 Control measures | 273 | 106 | 31 |
| 27 Dismounted individual | 52 | 122 | 65 |
| 30 Sea surface | 93 | 92 | 42 |
| 35 Sea subsurface | 22 | 89 | 43 |
| 36 Mine warfare | 65 | 67 | 26 |
| 40 Activities | 153 | 89 | 28 |
| 50–54 SIGINT | 4 each | 132 | 27 |
| 60 Cyberspace | 72 | 80 | 34 |

---

## 7. Implementation gotchas (all **[ran]** unless noted)

1. **Version `14` (APP-6E) loses the Suspect colour.**
   `numbersidc/metadata.js:36` reads `if (version == 13 && standardIdentity2 == 5)`.
   With version `14` the symbol is *not* marked suspect and falls back to the Hostile
   fill. Measured:
   * `130510000012110000000000000000` → `suspect: true`, fill `rgb(255, 229, 153)`
   * `140510000012110000000000000000` → `suspect: false`, fill `rgb(255,128,128)`

   **Fix:** emit version `13` internally and expose "APP-6E" purely as a label, **or**
   set `style.standard = "APP6"` and patch the suspect colour yourself.

2. **Version digits do not switch icon sets.** `metadata.STD2525` stays `true` for
   version `14`; only `style.standard = "APP6"` flips it to `false`. Measured.

3. **`metadata.feintDummy` is `undefined`, never `false`** (typo `fenintDummy` in the
   initialiser) — use truthiness.

4. **`getOctagonAnchor()` is wrong when `square: true`** — it is computed before the
   square adjustment. See §3.3.

5. **`FrameColor.Suspect` is `"rbg(...)"`** — invalid CSS. See §4.1.

6. **`sigint` (R2) and `auxiliaryEquipmentIndicator` (AG) are accepted but never
   drawn.** If your UI exposes them, label them as unsupported. **[src]**

7. **`infoBackgroundFrame` has no effect on its own** — `textfields.js` derives the
   background stroke from `infoBackground`. **[src]**

8. **Invalid amplifier digits silently invalidate the symbol.** Brute-forcing all 100
   two-digit amplifier values against `13031000<amp>1211000000 0000000000` gives exactly
   these `isValid() === false` codes:

   ```
   30, 38, 39, 40, 43, 44, 45, 46, 47, 48, 49,
   50, 53, 54, 55, 56, 57, 58, 59, 60, 63, 64, 65, 66, 67, 68, 69
   ```

   They all land in the `30 <= n < 70` branch without a table entry, so
   `metadata.mobility` becomes `undefined` and `isvalid.js` fails on
   `this.metadata.mobility != undefined`. Codes `00`-`29` and `70`-`99` are "valid" but
   draw nothing unless they are one of the 29 real amplifiers listed in §2.
   **Whitelist the 29 real codes (`11`-`18`, `21`-`26`, `31`-`37`, `41`, `42`, `51`,
   `52`, `61`, `62`, `71`, `72`) plus `00` in the UI.**

9. **Passing `colorMode` as an object gets that object mutated.** Pass a mode name
   string, or a fresh clone. **[src]**

10. **Control measures (set 25) render unframed and ignore the whole text-amplifier
    layout** in favour of per-symbol label overrides. Build a separate UI path for them.

11. **`style.strokeWidth` default is `4` in 3.0.4**, not `3` as the published docs
    still say. **[ran]** / **[pub]**

12. **`console.info` on import.** `src/ms.js` prints a banner to the console when
    `typeof process !== "object"` — i.e. **inside the Figma plugin sandbox it will log
    on every load**. Suppress it if that bothers you. **[src]**

13. **The SVG is already sanitised.** `assvg.js` blocks `<script>`, `foreignObject`,
    `on*=` handlers and `javascript:`, and whitelists dash-array / font-family /
    line-cap / text-anchor / baseline values. Safe to feed straight to
    `figma.createNodeFromSvg()`. **[src]**

---

## Sources

* Local source read directly: `node_modules/milsymbol/src/**` (v3.0.4, MIT),
  `node_modules/milstandard-e/tsv-tables/*.tsv` (MIT).
* [milsymbol docs README](https://github.com/spatialillusions/milsymbol/blob/master/docs/README.md) — amplifier option ↔ field-letter table.
* [milsymbol CHANGELOG](https://github.com/spatialillusions/milsymbol/blob/master/CHANGELOG.md) — 2525E / APP-6E support, Suspect colour.
* [Esri joint-military-symbology-xml issue #492](https://github.com/Esri/joint-military-symbology-xml/issues/492) — SIDC digits 21–30 in the published E edition.
* [SIDC identifiers in MIL-STD-2525D — Carmenta](https://docs.carmenta.com/pages/milstd2525d_tactical_sidc.html) — digits 1–20.
* [APP-6(C) NATO Joint Military Symbology](https://ia601602.us.archive.org/22/items/23-miscellanea/APP-6(C)%20NATO%20Joint%20Military%20Symbology%20-%20May%202011.pdf) — amplifier field letters, unused letters I/O/U.
* [MIL-STD-2525D](http://www.mapsymbs.com/MilStd2525D.pdf) — referenced, not fully parsed in this session.
