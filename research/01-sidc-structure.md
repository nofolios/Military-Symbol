# The APP-6E / MIL-STD-2525E 30-digit SIDC — positional reference

**Purpose:** implementation spec for the APP-6E Figma plugin. Every statement below is
either (a) read out of local source, (b) proved by running local code, or (c) taken from a
public document — each claim is tagged.

**Verification legend**

| Tag | Meaning |
|---|---|
| **[RAN]** | Proved by executing code against `node_modules/milsymbol@3.0.4` on this machine |
| **[SRC]** | Read directly out of local package source |
| **[TSV]** | Read out of `node_modules/milstandard-e@0.2.14/tsv-tables/*.tsv` |
| **[DOC]** | Public documentation / third-party implementation — *not* locally verifiable |
| **[GAP]** | Could **not** be verified; stated as uncertain |

**Local resources actually present** (checked with `ls`):

| Package | Version | Present? |
|---|---|---|
| `milsymbol` | 3.0.4 | yes |
| `milstandard-e` | 0.2.14 | yes |
| `mil-std-2525` (D-edition catalog) | — | **NO — not installed.** `node_modules/mil-std-2525` does not exist. D-vs-E comparison below is therefore done against *milsymbol's own* `edition == "D"` branches, not against that package. **[RAN]** |

Scratch scripts that produced every result here live in
`research/scratch/sidc-*.mjs`.

---

## 0. The one-paragraph summary

milsymbol parses a numeric SIDC with fixed `substr` offsets and **reads only characters 0–22
(digit positions 1–23)**. Digits 24–30 are read by nothing anywhere in `src/`. **[SRC]**
A SIDC shorter than 20 digits is not rejected — missing fields simply become `""` and
default via `|| "0"`. Digits 1–2 select *edition* (D vs E) only; the 2525-vs-APP-6 glyph
choice is a **render option** (`style.standard` / `ms.setStandard()`), **not** a SIDC field. **[RAN]**

```js
// node_modules/milsymbol/src/numbersidc/metadata.js — the complete list of SIDC reads
const version                  = sidc.substr(0, 2);        // digits 1-2
const standardIdentity1        = sidc.substr(2, 1);        // digit  3
const standardIdentity2        = sidc.substr(3, 1);        // digit  4
const symbolSet                = sidc.substr(4, 2);        // digits 5-6
const status                   = sidc.substr(6, 1);        // digit  7
const headquartersTaskForceDummy = sidc.substr(7, 1);      // digit  8
const echelonMobility          = sidc.substr(8, 2);        // digits 9-10
const functionid               = sidc.substr(10, 10);      // digits 11-20
const frameshape               = sidc.substr(22, 1) || "0";// digit  23
metadata._modifier1 = (sidc.substr(20,1) || "0") + functionid.substr(6,2); // digit 21 + digits 17-18
metadata._modifier2 = (sidc.substr(21,1) || "0") + functionid.substr(8,2); // digit 22 + digits 19-20
```

---

## 1. All 30 digit positions

| Pos | Field | Meaning | Legal values | milsymbol reads it? |
|---|---|---|---|---|
| 1–2 | Version / Standard & Edition | Which standard edition the code is written against | `10`,`11`,`12` → edition **D**; `13`,`14` → edition **E**; anything else → edition `undefined` | **yes** — `substr(0,2)` |
| 3 | Standard Identity 1 (Context) | Reality / Exercise / Simulation | `0` Reality, `1` Exercise, `2` Simulation (`3`–`9` → `context === undefined`) | **yes** — `substr(2,1)` |
| 4 | Standard Identity 2 (Affiliation) | Pending…Hostile, plus Joker/Faker/Suspect | `0`–`6` (`7`–`9` → `affiliation === undefined`) | **yes** — `substr(3,1)` |
| 5–6 | Symbol Set | Which entity catalog + which frame family | 20 sets with icons + `00` (unknown dimension); see §4 | **yes** — `substr(4,2)` |
| 7 | Status / Operational condition | Present/Planned/condition bar | `0`–`5` (`6`–`9` inert) | **yes** — `substr(6,1)` |
| 8 | HQ / Task Force / Dummy | 3-bit bitfield | `0`–`7` (`8`,`9` inert) | **yes** — `substr(7,1)` |
| 9–10 | Amplifier / Descriptor | Echelon, mobility, towed array, leadership | `00`,`11`–`18`,`21`–`26`,`31`–`37`,`41`,`42`,`51`,`52`,`61`,`62`,`71`,`72` | **yes** — `substr(8,2)` |
| 11–12 | Entity | 1st level of the entity hierarchy | per symbol set (`10`…`99`) | via `functionid` |
| 13–14 | Entity Type | 2nd level | per symbol set | via `functionid` |
| 15–16 | Entity Subtype | 3rd level; `95`–`98` reserved (see §7.2) | per symbol set | via `functionid` |
| 17–18 | Sector 1 Modifier | Icon drawn in the upper sector | `00`–`99`, per symbol set | **yes** |
| 19–20 | Sector 2 Modifier | Icon drawn in the lower sector | `00`–`99`, per symbol set | **yes** |
| 21 | Sector 1 Modifier **extension** (hundreds digit) | `1` switches Sector 1 to the **Common Modifiers** table | `0` (set-specific) or `1` (common, codes `100`–`166`); `2`–`9` always invalid | **yes** — `substr(20,1)` |
| 22 | Sector 2 Modifier **extension** (hundreds digit) | `1` switches Sector 2 to the **Common Modifiers** table | `0` or `1` (common, codes `100`–`125`); `2`–`9` always invalid | **yes** — `substr(21,1)` |
| 23 | Frame-shape override | Forces a frame family regardless of the symbol set | `0` none, `1`–`9` shapes, `A` unframed; see §8.2 | **yes** — `substr(22,1)` |
| 24–30 | *(see §8.3)* | Standard: national-extension payload. milsymbol: **ignored entirely** | any | **no** |

> **Caution — positions 21–30 have two competing readings.** milsymbol (and the wider
> "milsymbol ecosystem") treats 21/22/23 as modifier-extension + frame-shape. The published
> APP-6(D)(1) / 2525E text describes the *third ten digits* as a national-extension block
> whose first three digits are an ISO-3166 originator country code. See §8.3 — this is the
> single largest unresolved ambiguity in this spec.

---

## 2. Digits 1–2 — Version / Standard + Edition

### 2.1 What milsymbol actually does **[SRC]**

`node_modules/milsymbol/src/numbersidc/metadata.js`, lines 23–32 — this is the *entire*
version handling in the whole `src/` tree (verified by
`grep -rn "edition" src/`, which returns 10 hits, all listed below):

```js
if (version == "10" || version == "11" || version == "12") metadata.edition = "D";
if (version == "13" || version == "14")                    metadata.edition = "E";
if (version == 13 && standardIdentity2 == 5)               metadata.suspect = true;
```

Every other consumer of `edition` in the tree:

| File:line | Use |
|---|---|
| `src/numbersidc/metadata.js:170` | `if (frameshape != "0" && metadata.edition == "E")` — gates the frame-shape override |
| `src/symbolfunctions/icon.js:32` | icon-cache key includes the edition |
| `src/symbolfunctions/icon.js:164,187` | passes `metadata.edition` into `ms._getIcons.number()` |
| `src/numbersidc/geticons.js:1` | receives it as the `edition` parameter |
| `src/numbersidc/sidc/cyberspace.js` | ~20 `edition == "D" ? … : …` icon swaps |
| `src/numbersidc/sidc/landunit.js:514,518,522` | sector-1 codes `81`,`82`,`83` swap meaning |
| `src/iconparts/ground.js:1945` | `GR.M2.DENTAL` glyph swap (E = tooth path, D = the letter "D") |

**There is no code path anywhere that derives "2525 vs APP-6" from digits 1–2.** That choice
comes from `style.standard` (`"2525"` / `"APP6"`) or the global `ms.setStandard()`, feeding
`metadata.STD2525` (`src/ms/symbol/getmetadata.js:79-81`). **[SRC]**

### 2.2 Proof by rendering **[RAN]**

`research/scratch/version2.mjs` — Land-unit Infantry with Sector-1 modifier `81`, which
milsymbol swaps on edition (`D` = Command Post Node, `E` = NATO Medical Role 2 Basic).
SIDC pattern `VV` + `0310 0 0 00 1211008100`:

```
version | metadata.edition | SVG sha1[0:10] | bytes
--------|------------------|----------------|------
01      | undefined        | a92bcaaac5     | 522
10      | "D"              | dc76e4cc42     | 523
11      | "D"              | dc76e4cc42     | 523
12      | "D"              | dc76e4cc42     | 523
13      | "E"              | a92bcaaac5     | 522
14      | "E"              | a92bcaaac5     | 522
15      | undefined        | a92bcaaac5     | 522
```

Two render classes exist, not four. `10`/`11`/`12` produce byte-identical SVG; `13`/`14`
produce byte-identical SVG; **unknown versions fall into the E class** (because the code
tests `edition == "D"`, so `undefined` takes the else-branch).

Cyberspace entity `110400` (a 2525D "Zombie" that E disused) — the same story:
`10` → `d709b4f60b`, `13` → `d247901109`. **[RAN]**

Standard override is orthogonal — same SIDC `13036000001104000000`:
`standard:""` → `d247901109`, `standard:"2525"` → `d247901109`, `standard:"APP6"` → `d247901109`
(this particular icon is identical in both standards). A case where the standard *does*
differ, found by sweeping land-unit entities: **[RAN]**

```
13031000001504000000   2525 ≠ APP6
13031000001900000000   2525 ≠ APP6
13031000002002000000   2525 ≠ APP6
13031000002003000000   2525 ≠ APP6
13030100001101000000   2525 ≠ APP6   (Air / Military / Fixed Wing)
13030100001201000000   2525 ≠ APP6   (Air / Civilian)
```

### 2.3 The definitive value assignment

Locally provable: **[RAN]**

| Value | milsymbol edition | Render class |
|---|---|---|
| `10` | D | D |
| `11` | D | D |
| `12` | D | D |
| `13` | E | E |
| `14` | E | E |
| anything else | `undefined` | E (falls through) |

Which *named* standard each value denotes is **not encoded anywhere in the local packages**
**[GAP]**. Two independent public sources agree on the following, and both are consistent
with milsymbol's grouping: **[DOC]**

| Value | Standard | Source |
|---|---|---|
| `10` | **MIL-STD-2525D** (also used as the generic APP-6(D) value) | `psylsph/milsymbol-sidc` README; Carmenta APP-6D docs state APP-6D version = `10` |
| `11` | **APP-6(D)** | `psylsph/milsymbol-sidc` README |
| `12` | D-family; no published assignment found | — |
| `13` | **MIL-STD-2525E** | `psylsph/milsymbol-sidc` README |
| `14` | **APP-6(E)** | `psylsph/milsymbol-sidc` README |

`github.com/d0707de7/sidc` (Go) independently encodes the same split: *"leading 10, 11 or 12
→ APP-6 D; leading 13 or 14 → APP-6 E"*. **[DOC]**

> **Recommendation for the plugin:** emit **`14`** (APP-6E). Offer `13` (2525E) as an
> alternative. Do **not** rely on digits 1–2 to pick the NATO vs US glyph set — set
> `style.standard = "APP6"` explicitly, because milsymbol defaults `ms._STD2525 = true`
> (i.e. **US 2525 glyphs**) when you don't. **[SRC]** `src/ms.js:77`

> **Known milsymbol bug — `version == 13` only.** The Suspect-colour rule is written
> `if (version == 13 && standardIdentity2 == 5)` — a *numeric* comparison against `13`.
> `"14"` fails it. Proved: SIDC `…0510…` with SI2 = `5`:
> version `13` → frame fill `rgb(255, 229, 153)` (Suspect amber);
> version `14` → frame fill `rgb(255,128,128)` (plain Hostile red). **[RAN]**
> If your plugin emits `14` you lose Suspect colouring. Work-arounds: emit `13`, or
> post-process `symbol.metadata.suspect = true` before reading colours.

---

## 3. Digit 3 (Context) and digit 4 (Standard Identity)

### 3.1 Digit 3 — Standard Identity 1 / Context

`mapping.context = ["Reality", "Exercise", "Simulation"]`, indexed by `parseInt(digit3)`.
**[SRC]** `src/ms/symbol/getmetadata.js:33`

| Digit 3 | `metadata.context` | Rendered amplifier | Verified |
|---|---|---|---|
| `0` | `"Reality"` | *(nothing)* | **[RAN]** |
| `1` | `"Exercise"` | bold `X` at `x = bbox.x2 + spacing`, `y = 50`, `fontsize 35` — or `J` (joker) / `K` (faker) at `y = 40` instead | **[RAN]** **[SRC]** `src/symbolfunctions/affliationdimension.js:31-75` |
| `2` | `"Simulation"` | bold `S` at `x = bbox.x2 + spacing`, `fontsize 35` | **[SRC]** `affliationdimension.js:76` |
| `3`–`9` | `undefined` | nothing; symbol still renders and `isValid()` still returns `true` | **[RAN]** |

`spacing` is `+10`, or `-10` when affiliation is Unknown, or Hostile-and-not-Subsurface. **[SRC]**

### 3.2 Digit 4 — Standard Identity 2 / Affiliation

```js
const affiliationMapping = { 0:"Unknown", 1:"Unknown", 2:"Friend", 3:"Friend",
                             4:"Neutral", 5:"Hostile", 6:"Hostile" };
```
**[SRC]** `src/numbersidc/metadata.js:13-21`

Measured at `context = 0` (Reality): **[RAN]**

| Digit 4 | Standard name | `metadata.affiliation` | Frame | Dash (`notpresent`) | Fill (Light mode) |
|---|---|---|---|---|---|
| `0` | Pending | `Unknown` | Unknown (quatrefoil) | `"4,4"` (pending) | `rgb(255,255,128)` |
| `1` | Unknown | `Unknown` | Unknown (quatrefoil) | — | `rgb(255,255,128)` |
| `2` | Assumed Friend | `Friend` | Friend (rectangle) | `"4,4"` (pending) | `rgb(128,224,255)` |
| `3` | Friend | `Friend` | Friend (rectangle) | — | `rgb(128,224,255)` |
| `4` | Neutral | `Neutral` | Neutral (square) | — | `rgb(170,255,170)` |
| `5` | Suspect / Joker | `Hostile` | Hostile (diamond) | `"4,4"` (pending) | `rgb(255,128,128)`; **amber `rgb(255, 229, 153)` if version == `13`** |
| `6` | Hostile / Faker | `Hostile` | Hostile (diamond) | — | `rgb(255,128,128)` |
| `7`–`9` | *(illegal)* | `undefined` (the JS value, **not** the string) | none — no geometry found | — | `undefined` |

The dashed-frame rule **[SRC]** `metadata.js:102-107`:

```js
if (standardIdentity2 == "0" || standardIdentity2 == "2" || standardIdentity2 == "5")
  metadata.notpresent = ms._dashArrays.pending;   // "4,4"
```

Dash arrays (`ms.getDashArrays()`, settable via `ms.setDashArrays()`): **[SRC]** `src/ms.js:62-66`

| Name | Value | Used for |
|---|---|---|
| `pending` | `"4,4"` | SI2 ∈ {0,2,5}; plus ETC/POSCON and fused sea/subsurface tracks |
| `anticipated` | `"8,12"` | status digit 7 = `1` |
| `feintDummy` | `"8,8"` | digit 8 ∈ {1,3,5,7} |

### 3.3 Joker, Faker and Suspect — the special cases

```js
if (standardIdentity2 == "5" && standardIdentity1 == "1") metadata.joker = true;
if (standardIdentity2 == "6" && standardIdentity1 == "1") metadata.faker = true;
if (metadata.joker || metadata.faker) metadata.affiliation = mapping.affiliation[1]; // "Friend"
```
**[SRC]** `metadata.js:126-133`. Then `getColors()` repaints the friendly frame hostile: **[SRC]** `src/ms/symbol/getcolors.js:31-42`

```js
if (metadata.joker || metadata.faker) {
  baseFillColor.Friend  = baseFillColor.Hostile;
  baseFrameColor.Friend = baseFrameColor.Hostile;
  baseIconColor.Friend  = baseIconColor.Hostile;
}
if (metadata.suspect) {
  baseFillColor.Friend = baseFillColor.Hostile = baseFillColor.Suspect;
  /* …frame and icon likewise… */
}
```

Complete case table (digit 3 × digit 4). Measured `metadata` + frame fill: **[RAN]**

| d3 | d4 | Name | `baseAffilation` | `affiliation` (frame shape) | Frame fill | Letter drawn | Dashed |
|---|---|---|---|---|---|---|---|
| 0 | 5 | Suspect | `Hostile` | `Hostile` (diamond) | `rgb(255,128,128)` (v14) / `rgb(255, 229, 153)` (v13) | — | yes `4,4` |
| 0 | 6 | Hostile | `Hostile` | `Hostile` (diamond) | `rgb(255,128,128)` | — | no |
| 1 | 5 | **Joker** | `Hostile` | **`Friend`** (rectangle) | hostile red (v14) / suspect amber (v13) | **`J`** | yes `4,4` |
| 1 | 6 | **Faker** | `Hostile` | **`Friend`** (rectangle) | hostile red | **`K`** | no |
| 1 | 0–4 | Exercise <affil> | as usual | as usual | as usual | `X` | per d4 |
| 2 | any | Simulation | as usual | as usual | as usual | `S` | per d4 |

Measured geometry deltas confirm the frame swap — Land unit at `size:100`: **[RAN]**

```
Reality Hostile  (0,6)  →  152 × 152 px  (diamond)
Reality Suspect  (0,5)  →  152 × 152 px  (diamond), dasharray 4,4
Exercise Joker   (1,5)  →  190 × 143 px  (Friend rectangle + "J"), dasharray 4,4
Exercise Faker   (1,6)  →  190 × 143 px  (Friend rectangle + "K"), no dash
```

Suspect colours by colour mode (`Suspect` key, `src/colormodes.js`): **[SRC]**
`Light rgb(255, 229, 153)` · `Medium rgb(255, 217, 107)` · `Dark rgb(255, 188, 1)` ·
`IconColor rgb(255, 188, 1)` · `FrameColor` is the **typo** `"rbg(255, 188, 1)"` (note `rbg`)
— an invalid CSS colour; harmless in the default path because `frameColor` is replaced by
`Black` for framed symbols, but do not rely on it.

Another special case: **[SRC]** `metadata.js:137-143`

```js
// dimension unknown + Exercise + not-Unknown affiliation  ->  no frame shape at all
if (symbolSet == "00" && standardIdentity1 == "1" && metadata.affiliation != "Unknown")
  metadata.affiliation = "";
```

---

## 4. Digits 5–6 — Symbol Set

### 4.1 Dimension mapping **[SRC]** `src/numbersidc/metadata.js:34-56`

```js
const dimensionMapping = {
  "00":"Sea", "01":"Air", "02":"Air", "05":"Air", "06":"Air",
  10:"Ground", 11:"Ground", 12:"Ground", 15:"Ground", 20:"Ground",
  30:"Sea", 35:"Subsurface", 36:"Subsurface", 39:"Subsurface", 40:"Ground",
  50:"Air", 51:"Air", 52:"Ground", 53:"Sea", 54:"Subsurface", 60:"Ground"
};
```

This is the *raw* lookup. It is then **overridden** by three later rules: **[SRC]**

| Rule | Effect |
|---|---|
| `if (symbolSet == "27")` | `dimension = "LandDismountedIndividual"`, `dismounted = true` |
| `if (symbolSet == "15" \|\| symbolSet == "52")` | `dimension = mapping.dimension[2]` = **`"Sea"`** — land equipment and SIGINT-Land use the *sea* frame geometry |
| digit 23 frame-shape override (edition E) | replaces `dimension` entirely — see §8.2 |

Note `dimensionMapping` has **no key `25`** (Control Measure) — so `metadata.dimension` is `""`
for control measures, which `isValid()` special-cases.

### 4.2 The full symbol-set table

Columns: milsymbol's dimension + flags **[SRC]**, milstandard-e's name + TSV files **[TSV]**,
and whether a symbol actually renders **[RAN]**.

| Set | Name (milstandard-e) | Base dimension (frame family) | milsymbol flags | Entity TSV | Sector-1 TSV | Sector-2 TSV | Renders |
|---|---|---|---|---|---|---|---|
| `00` | *(Unknown / dimension undetermined)* | `Sea` + `dimensionUnknown` (draws a big "?") | `dimensionUnknown` | — | — | — | frame only, `isValid()` **false** |
| `01` | Air | `Air` | — | `Air.tsv` | `Air sector 1.tsv` | `Air sector 2.tsv` | yes |
| `02` | Air missile | `Air` | — | `Air missile.tsv` | `Air missile sector 1.tsv` | `Air missile sector 2.tsv` | yes |
| `05` | Space | `Air` | `space` | `Space.tsv` | `Space sector 1.tsv` | `Space sector 2.tsv` | yes |
| `06` | Space Missile | `Air` | `space` | `Space missile.tsv` | `Space missile sector 1.tsv` | `Space missile sector 2.tsv` | yes |
| `10` | Land unit | `Ground` | `unit` | `Land unit.tsv` | `Land unit sector 1.tsv` | `Land unit sector 2.tsv` | yes |
| `11` | Land civilian unit/Organization | `Ground` | `unit`, `civilian` (always) | `Land civilian.tsv` | `Land civilian sector 1.tsv` | `Land civilian sector 2.tsv` | yes |
| `12` | *(no catalog — `dimensionMapping` only)* | `Ground` | — | — | — | — | **no icons**, `isValid()` false |
| `15` | Land equipment | **`Sea`** (overridden) | `landequipment` | `Land equipment.tsv` | `Land equipment sector 1.tsv` | `Land equipment sector 2.tsv` | yes |
| `20` | Land installations | `Ground` | `installation` | `Land installation.tsv` | `Land installation sector 1.tsv` | `Land installation sector 2.tsv` | yes |
| `25` | Control measure | `""` (none) | `unit`, `controlMeasure` | `Control Measures.tsv` | `Control Measures sector 1.tsv` | `Control Measures sector 2.tsv` | **partial** — point control measures only (42 %) |
| `27` | Dismounted individuals | `LandDismountedIndividual` | `unit`, `dismounted` | `Dismounted individual.tsv` | `Dismounted individual sector 1.tsv` | `Dismounted individual sector 2.tsv` | yes |
| `30` | Sea surface | `Sea` | — | `Sea surface.tsv` | `Sea surface sector 1.tsv` | `Sea surface sector 2.tsv` | yes |
| `35` | Sea subsurface | `Subsurface` | — | `Sea subsurface.tsv` | `Sea subsurface sector 1.tsv` | `Sea subsurface sector 2.tsv` | yes |
| `36` | Mine warfare | `Subsurface` | `fill=false` unless `style.alternateMedal` | `Mine warfare.tsv` | *(none)* | *(none)* | yes |
| `39` | *(no catalog — `dimensionMapping` only)* | `Subsurface` | — | — | — | — | **no icons**, `isValid()` false |
| `40` | Activity/Event | `Ground` | `unit`, `activity` | `Activities.tsv` | `Activities sector 1.tsv` | `Activities sector 2.tsv` | yes |
| `50` | Signals Intelligence – Space | `Air` | `space` | `Signals intelligence.tsv` | `Signals intelligence sector 1.tsv` | `Signals intelligence sector 2.tsv` | yes |
| `51` | Signals Intelligence – Air | `Air` | — | *(same three files)* | | | yes |
| `52` | Signals Intelligence – Land | **`Sea`** (overridden) | — | *(same three files)* | | | yes |
| `53` | Signals Intelligence – Surface | `Sea` | — | *(same three files)* | | | yes |
| `54` | Signals Intelligence – Subsurface | `Subsurface` | — | *(same three files)* | | | yes |
| `60` | Cyberspace | `Ground` | `cyberspace` | `Cyberspace.tsv` | `Cyberspace sector 1.tsv` | `Cyberspace sector 2.tsv` | yes |

**Per-entity special cases inside a symbol set** **[SRC]** `metadata.js:93-116` — all ten rows re-verified by rendering **[RAN]**

| Condition | Effect |
|---|---|
| set `36` and `style.alternateMedal === false` (the default) | `metadata.fill = false` — sea mines render unfilled (MEDAL icons) |
| set `30`, entity `150000` | `metadata.frame = false` — "sea own track" is unframed |
| set `30`, entity `160000` | `notpresent = "4,4"` — all ETC/POSCON tracks get a pending frame |
| set `35`, entity `140000` | `notpresent = "4,4"` — fused tracks |
| set `35`, entity `150000` | `notpresent = "4,4"` — fused tracks |
| set `01`/`05`/`12` entity starting `12`; set `11` (all); set `15` entity starting `16`; set `30` entity starting `14`; set `35` entity starting `12` | `metadata.civilian = true` → purple civilian colours when `style.civilianColor` (default `true`) |

Every other 2-digit value (`03`,`04`,`07`–`09`,`13`,`14`,`16`–`19`,`21`–`24`,`26`,`28`,`29`,
`31`–`34`,`37`,`38`,`41`–`49`,`55`–`59`,`61`–`99`) yields
`metadata.dimension === ""`, no base geometry, and `isValid() === false`. **[RAN]**

**Cross-check: milsymbol's `if (symbolSet == "NN")` guards** in `src/numbersidc/sidc/*.js` **[SRC]**

| File | Guards |
|---|---|
| `air.js` | `01` |
| `airmissile.js` | `02` |
| `space.js` | `05` |
| `spacemissile.js` | `06` |
| `landunit.js` | `10` |
| `landcivilian.js` | `11` |
| `landequipment.js` | `15` |
| `landinstallation.js` | `20` |
| `control-measure.js` | `25` |
| `dismountedindividual.js` | `27` |
| `sea.js` | `30` |
| `subsurface.js` | `35` |
| `minewarfare.js` | `36` |
| `activites.js` | `40` |
| `signalsintelligence.js` | `50`,`51`,`52`,`53`,`54` |
| `cyberspace.js` | `60` |
| `common.js` | **none** — its modifiers apply to *every* set |

This is an exact match with `milstandard-e/src/2525e.js`'s key set
(`01,02,05,06,10,11,15,20,25,27,30,35,36,40,50,51,52,53,54,60` + `common`), **[TSV]**
except that milstandard-e has no entry for `00`, `12` or `39` and milsymbol has no icon
catalog for `12` or `39`. `12` and `39` exist **only** in milsymbol's `dimensionMapping`
and are almost certainly vestigial. **[GAP]** no local or public source explains them.

### 4.3 Base geometry keys **[SRC]** `src/ms/symbolgeometries.js`

`metadata.baseGeometry = ms._symbolGeometries[metadata.dimension + metadata.affiliation]`.
The 21 keys are:

```
AirHostile AirFriend AirNeutral AirUnknown
GroundHostile GroundFriend GroundNeutral GroundUnknown
LandDismountedIndividualHostile LandDismountedIndividualFriend
LandDismountedIndividualNeutral LandDismountedIndividualUnknown
SeaHostile SeaFriend SeaNeutral SeaUnknown
SubsurfaceHostile SubsurfaceFriend SubsurfaceNeutral SubsurfaceUnknown
PositionMarker
```

Friend shapes: `AirFriend` arc, `GroundFriend` `M25,50 l150,0 0,100 -150,0 z` (150×100 rect),
`SeaFriend` circle r=60 at (100,100), `SubsurfaceFriend` bowl,
`LandDismountedIndividualFriend` hexagon `m 100,45 55,25 0,60 -55,25 -55,-25 0,-60 z`.
Missing key ⇒ empty `BBox` ⇒ nothing drawn. **[SRC]** `getmetadata.js:113-122`

### 4.4 Entity coverage measured **[RAN]**

Every 6-digit entity code in each TSV, rendered as `1403<set>0000<code>0000`, then `isValid()`:

| Set | Catalog entities | Render OK | Coverage |
|---|---|---|---|
| `01` | 53 | 53 | 100 % |
| `02` | 1 | 1 | 100 % |
| `05` | 36 | 36 | 100 % |
| `06` | 1 | 1 | 100 % |
| `10` | 214 | 214 | 100 % |
| `11` | 11 | 11 | 100 % |
| `15` | 206 | 206 | 100 % |
| `20` | 131 | 131 | 100 % |
| `25` | 628 | **264** | **42.0 %** |
| `27` | 45 | 45 | 100 % |
| `30` | 93 | 93 | 100 % |
| `35` | 22 | 22 | 100 % |
| `36` | 65 | 65 | 100 % |
| `40` | 152 | 152 | 100 % |
| `50`–`54` | 4 each | 4 each | 100 % |
| `60` | 43 | 43 | 100 % |
| **Total** | **1721** | **1357** | **78.8 %** |

The whole 21 % shortfall is Control Measures: `src/numbersidc/sidc/control-measure.js`
implements only the **point**-type graphics (entity `13xxxx` and friends). Lines, areas and
boundaries are not renderable by milsymbol at all. **[SRC]** **[RAN]**
`Control Measures.tsv` carries an extra `Geometric Rendering` column whose observed values are
`Point` (254 rows), `Area` (195), `Line` (95), `Corridor` (7), `Axis` (5) and empty (72) —
use it to hide or grey the entries milsymbol cannot draw. **[TSV]**

---

## 5. Digit 7 (Status) and digit 8 (HQ / Task Force / Dummy)

### 5.1 Digit 7 — Status / Operational condition

```js
mapping.status = ["Present","Planned","FullyCapable","Damaged","Destroyed","FullToCapacity"];
if (status == "1") metadata.notpresent = ms._dashArrays.anticipated;          // "8,12"
if (status == "2" || status == "3" || status == "4" || status == "5")
  metadata.condition = mapping.status[parseInt(status)];
```
**[SRC]** `metadata.js:100-120`

| d7 | Name | `metadata` effect | Visual feature | Measured (Land unit Friend, `size:100`) **[RAN]** |
|---|---|---|---|---|
| `0` | Present | — | plain frame | 158×108 px, 343-byte SVG, no dasharray |
| `1` | Planned / Anticipated | `notpresent = "8,12"` | **frame redrawn dashed** `8,12` over the fill | 158×108, 471 bytes, `stroke-dasharray="8,12"` |
| `2` | Fully Capable | `condition = "FullyCapable"` | **condition bar** below the frame, fill `rgb(0,255,0)` | 158×**138**, 442 bytes |
| `3` | Damaged | `condition = "Damaged"` | condition bar, fill `rgb(255,255,0)` | 158×138, 444 bytes |
| `4` | Destroyed | `condition = "Destroyed"` | condition bar, fill `rgb(255,0,0)` | 158×138, 442 bytes |
| `5` | Full to Capacity | `condition = "FullToCapacity"` | condition bar, fill `rgb(0, 180, 240)` | 158×138, 446 bytes |
| `6`–`9` | *(illegal)* | nothing | identical to `0` | 158×108, 343 bytes |

**Condition-bar geometry** **[SRC]** `src/symbolfunctions/statusmodifier.js:9-49`

```js
y2 = bbox.y2;
if (!metadata.frame && metadata.iconBottom) y2 = metadata.iconBottom;
if (options.headquartersElement)            y2 += 35;
y2 += metadata.mobility ? 25 : 5;              // clear the mobility glyph
path = "M" + bbox.x1 + "," + y2 + " l" + bbox.width() + ",0 0,25 -" + bbox.width() + ",0 z";
// height 25, full frame width, stroked with the frame colour
```

**Simple status modifier fallback.** The bar is only drawn when
`metadata.fill && style.monoColor === "" && !style.simpleStatusModifier`. Otherwise: **[SRC]**
`statusmodifier.js:62-90`

| Condition | Simple form |
|---|---|
| `Damaged` | one diagonal stroke `M150,20 L50,180` at `strokeWidth * 2` |
| `Destroyed` | that stroke **plus** `M50,20 L150,180` (an X) |
| `FullyCapable`, `FullToCapacity` | nothing |

### 5.2 Digit 8 — HQ / Task Force / Feint-Dummy

It is a **3-bit bitfield**, decoded by membership tests: **[SRC]** `metadata.js:220-226`

```js
if (["1","3","5","7"].indexOf(d8) > -1) metadata.feintDummy   = true;  // bit 0
if (["2","3","6","7"].indexOf(d8) > -1) metadata.headquarters = true;  // bit 1
if (["4","5","6","7"].indexOf(d8) > -1) metadata.taskForce    = true;  // bit 2
```

| d8 | Feint/Dummy | HQ | Task Force | Standard name | Measured height at `size:100` (Land unit Friend, base 108 px) **[RAN]** |
|---|---|---|---|---|---|
| `0` | – | – | – | Not applicable | 108 |
| `1` | ✔ | – | – | Feint/Dummy | 183 (dasharray `8,8` present) |
| `2` | – | ✔ | – | Headquarters | 208 |
| `3` | ✔ | ✔ | – | Feint/Dummy Headquarters | 283 (dasharray `8,8`) |
| `4` | – | – | ✔ | Task Force | 148 |
| `5` | ✔ | – | ✔ | Feint/Dummy Task Force | 183 (dasharray `8,8`) |
| `6` | – | ✔ | ✔ | Task Force Headquarters | 248 |
| `7` | ✔ | ✔ | ✔ | Feint/Dummy Task Force Headquarters | 283 (dasharray `8,8`) |
| `8`,`9` | – | – | – | *(illegal)* | 108 — identical to `0` |

**Exactly what each bit draws** **[SRC]** `src/symbolfunctions/modifier.js`

* **Headquarters (bit 1)** — a vertical staff dropped from the frame's lower-left corner:
  `M<bbox.x1>,<y> L<bbox.x1>,<bbox.y2 + hqStaffLength>`, default `hqStaffLength = 100`
  (`ms._hqStaffLength`, override with `ms.setHqStaffLength()` or `style.hqStaffLength`).
  `y` is `bbox.y2` for `AirFriend`, `AirNeutral`, `GroundFriend`, `GroundNeutral`,
  `SeaNeutral`, `SubsurfaceNeutral`, otherwise `100`. `lines 13-58`
  Setting `hqStaffLength = 0` suppresses the staff entirely.
  **The symbol anchor moves to the foot of the staff** when `metadata.headquarters` is true —
  `setoptions.js:95-101`. Important for placement in Figma.
* **Task Force (bit 2)** — a `⊓` bracket above the frame, from `bbox.y1` up to `bbox.y1 - 40`,
  width 90 by default, widened by echelon:
  `Corps/MEF → 110`, `Army → 145`, `Army Group/front → 180`, `Region/Theater → 215`. `lines 61-75`
* **Feint/Dummy (bit 0)** — a **dashed inverted V** (chevron) over the frame:
  ```js
  const topPoint = bbox.y1 - bbox.width() / 2;
  d = "M100,"+topPoint+" L"+bbox.x1+","+bbox.y1+
      " M100,"+topPoint+" L"+bbox.x2+","+bbox.y1;
  strokedasharray = ms._dashArrays.feintDummy;   // "8,8"
  ```
  `lines 161-195`. Apex is directly above the frame centre at half the frame width above the
  frame top; the two legs run down to the frame's top-left and top-right corners.

---

## 6. Digits 9–10 — Amplifier / Descriptor (echelon, mobility, towed array, leadership)

### 6.1 The dispatch logic **[SRC]** `metadata.js:228-237`

```js
if (echelonMobility <= 30)                        metadata.echelon    = mapping.echelonMobility[echelonMobility];
if (echelonMobility >= 30 && echelonMobility < 70) metadata.mobility   = mapping.echelonMobility[echelonMobility];
if (echelonMobility >= 70 && echelonMobility < 80) metadata.leadership = mapping.echelonMobility[echelonMobility];
```

`echelonMobility` is the **string** `"NN"`; the comparisons coerce it to a number, the table
lookup uses the string. Consequences (all measured): **[RAN]**

* `"30"` satisfies **both** the first and second branch → `echelon = undefined` *and*
  `mobility = undefined` → `isValid()` **false**.
* `"00"`–`"29"` with no table entry → `echelon = undefined`, `mobility` stays `""` → still **valid**.
* `"38"`–`"69"` with no table entry → `mobility = undefined` → **invalid**.
* `"70"`, `"73"`–`"79"` → `leadership = undefined`, nothing else touched → still **valid**.
* `"80"`–`"99"` → no branch taken at all → still **valid**, renders as if `00`.

### 6.2 The complete table **[SRC]** `src/ms/symbol/getmetadata.js:42-72` — verified value-by-value **[RAN]**

The table is **global**, not per-symbol-set: milsymbol applies the same map to every set. What
differs per set is which values are *meaningful* (right-hand column is the standard's intent).

| Code | `metadata` field | Label (verbatim from milsymbol) | Group | Applicable symbol sets (per the standard) |
|---|---|---|---|---|
| `00` | — | *(no amplifier)* | — | all |
| `11` | `echelon` | `Team/Crew` | Echelon, brigade and below | `10`,`11`,`20`,`27`,`40` |
| `12` | `echelon` | `Squad` | Echelon, brigade and below | `10`,`11`,`20`,`27`,`40` |
| `13` | `echelon` | `Section` | Echelon, brigade and below | `10`,`11`,`20`,`27`,`40` |
| `14` | `echelon` | `Platoon/detachment` | Echelon, brigade and below | `10`,`11`,`20`,`27`,`40` |
| `15` | `echelon` | `Company/battery/troop` | Echelon, brigade and below | `10`,`11`,`20`,`27`,`40` |
| `16` | `echelon` | `Battalion/squadron` | Echelon, brigade and below | `10`,`11`,`20`,`27`,`40` |
| `17` | `echelon` | `Regiment/group` | Echelon, brigade and below | `10`,`11`,`20`,`27`,`40` |
| `18` | `echelon` | `Brigade` | Echelon, brigade and below | `10`,`11`,`20`,`27`,`40` |
| `21` | `echelon` | `Division` | Echelon, division and above | `10`,`11`,`20`,`40` |
| `22` | `echelon` | `Corps/MEF` | Echelon, division and above | `10`,`11`,`20`,`40` |
| `23` | `echelon` | `Army` | Echelon, division and above | `10`,`11`,`20`,`40` |
| `24` | `echelon` | `Army Group/front` | Echelon, division and above | `10`,`11`,`20`,`40` |
| `25` | `echelon` | `Region/Theater` | Echelon, division and above | `10`,`11`,`20`,`40` |
| `26` | `echelon` | `Command` | Echelon, division and above | `10`,`11`,`20`,`40` |
| `31` | `mobility` | `Wheeled limited cross country` | Equipment mobility on land | `15`,`27`,`52` |
| `32` | `mobility` | `Wheeled cross country` | Equipment mobility on land | `15`,`27`,`52` |
| `33` | `mobility` | `Tracked` | Equipment mobility on land | `15`,`27`,`52` |
| `34` | `mobility` | `Wheeled and tracked combination` | Equipment mobility on land | `15`,`27`,`52` |
| `35` | `mobility` | `Towed` | Equipment mobility on land | `15`,`27`,`52` |
| `36` | `mobility` | `Rail` | Equipment mobility on land | `15`,`27`,`52` |
| `37` | `mobility` | `Pack animals` | Equipment mobility on land | `15`,`27`,`52` |
| `41` | `mobility` | `Over snow (prime mover)` | Equipment mobility on snow | `15`,`52` |
| `42` | `mobility` | `Sled` | Equipment mobility on snow | `15`,`52` |
| `51` | `mobility` | `Barge` | Equipment mobility on water | `15`,`30`,`52`,`53` |
| `52` | `mobility` | `Amphibious` | Equipment mobility on water | `15`,`30`,`52`,`53` |
| `61` | `mobility` | `Short towed array` | Naval towed array | `30`,`35`,`53`,`54` |
| `62` | `mobility` | `Long towed Array` *(sic — capital A)* | Naval towed array | `30`,`35`,`53`,`54` |
| `71` | `leadership` | `Leader Individual` | Leadership (E-edition) | `27` |
| `72` | `leadership` | `Deputy Individual` | Leadership (E-edition) | `27` |

**Every other value of digits 9–10**, exhaustively enumerated `00`–`99`: **[RAN]**

| Values | Result | `isValid()` |
|---|---|---|
| `00`–`10`, `19`, `20`, `27`–`29` | `echelon === undefined`, no glyph | **true** |
| `30` | `echelon === undefined` **and** `mobility === undefined` | **false** |
| `38`,`39`,`40`,`43`–`50`,`53`–`60`,`63`–`69` | `mobility === undefined` | **false** |
| `70`, `73`–`79` | `leadership === undefined`, no glyph | **true** |
| `80`–`99` | no branch taken, no glyph | **true** |

> The "applicable symbol sets" column is the *standard's* intent and is **[GAP]** —
> milsymbol enforces none of it. `14031000331211000000` (a Land **unit** with mobility
> `Tracked`) renders happily. If the plugin wants to be standard-correct it must gate the
> amplifier picker on the symbol set itself.

### 6.3 What each amplifier draws

* **Echelon** `modifier.js:199-467` — glyphs centred on `x = 100` above `bbox.y1`
  (circles, bars, `X`s, `+`s). When `metadata.installation` is true an extra
  `installationPadding = 15` is added to the bbox so the echelon clears the installation flag.
* **Mobility** `modifier.js:469-619` — glyphs **below** `bbox.y2`. `Towed`,
  `Short towed array` and `Long towed Array` take a special branch, as do
  `Over snow (prime mover)`, `Sled` and `Barge`.
* **Leadership** `modifier.js:621-638` — a chevron `m 45,60 55,-25 55,25` drawn **only for
  `affiliation === "Friend"`**; the Neutral/Hostile/Unknown variants are commented out in
  the source, so a hostile dismounted leader draws no leadership glyph. **[SRC]**
  Note `Leader Individual` and `Deputy Individual` currently render **identically** — the
  dashed-deputy line is commented out (`modifier.js:631-632`). **[SRC]**
* Mobility also pushes the condition bar down by 25 px (`statusmodifier.js:30`). **[SRC]**

---

## 7. Digits 11–16 (Entity / Type / Subtype) and 17–20 (Sector modifiers)

### 7.1 Structure

Digits 11–20 are handled as one 10-character string, `metadata.functionid`: **[SRC]**

| Slice of `functionid` | SIDC digits | Meaning | Look-up key |
|---|---|---|---|
| `[0..1]` | 11–12 | Entity | — |
| `[2..3]` | 13–14 | Entity Type | — |
| `[4..5]` | 15–16 | Entity Subtype | — |
| `[0..5]` | 11–16 | **the icon key** | `icons["<6 digits>"]` |
| `[6..7]` | 17–18 | Sector 1 modifier | `m1["<2 or 3 digits>"]` |
| `[8..9]` | 19–20 | Sector 2 modifier | `m2["<2 or 3 digits>"]` |

Codes are **hierarchical**: `AABBCC` where `AABB00` is the parent of `AABBCC` and `AA0000`
the grandparent. `milstandard-e`'s TSVs encode exactly that in three columns
(`Entity`, `Entity Type`, `Entity Subtype`) with the 6-digit `Code` in the fourth. **[TSV]**
Rows whose `Remarks` read `Reserved for hierarchical purposes.` are branch nodes, and
`{Disused}` marks retired codes — the plugin should hide both from pickers.

### 7.2 Entity subtype `95`–`98` — the reserved support-level block **[SRC]** **[RAN]**

```js
// icon.js:252-259 — fall back to the parent icon
let mainIcon = icons[functionid.substr(0,6)];
if (typeof mainIcon === "undefined" && functionid.substr(4,2) >= 95)
  mainIcon = icons[functionid.substr(0,4) + "00"];
// icon.js:346-355 — then stamp an extra glyph
if (functionid.substr(4,2) == "95") drawArray2.push(iconParts["GR.IC.FF.HEADQUARTERS OR HEADQUARTERS ELEMENT"]);
if (functionid.substr(4,2) == "96") drawArray2.push(iconParts["GR.IC.FF.DIVISION AND BELOW SUPPORT"]);
if (functionid.substr(4,2) == "97") drawArray2.push(iconParts["GR.IC.FF.CORPS SUPPORT"]);
if (functionid.substr(4,2) == "98") drawArray2.push(iconParts["GR.IC.FF.THEATRE SUPPORT"]);
```

Measured on Land-unit Infantry `1211` at `size:40`: **[RAN]**

| Entity subtype | SVG bytes | Meaning |
|---|---|---|
| `00` | 345 | plain Infantry |
| `95` | 422 | + Headquarters / HQ element |
| `96` | 428 | + Division-and-below support |
| `97` | 429 | + Corps support |
| `98` | 450 | + Theatre support |
| `99` | 345 | falls back to `…00`, **no extra glyph** |

These four codes are **not** present in the milstandard-e TSVs — they are a global convention
implemented only in code. Your picker must synthesise them. **[TSV]** **[SRC]**

### 7.3 Sector modifier look-up **[SRC]** `icon.js:356-392`

```js
if (metadata._modifier1.substr(0,1) == "0") {          // digit 21 == "0"
  if (functionid.substr(6,2) != "00") {                //   use the 2-digit set-specific code
    const modifier1 = m1[functionid.substr(6,2)];
    if (typeof modifier1 === "undefined") this.validIcon = false; else drawArray2.push(modifier1);
  }
} else {                                               // digit 21 != "0"
  const modifier1 = m1[metadata._modifier1];           //   use the 3-digit common code
  if (typeof modifier1 === "undefined") this.validIcon = false; else drawArray2.push(modifier1);
}
```
…and the mirror image for modifier 2 with `substr(8,2)` / `_modifier2`.

Two consequences worth knowing:

1. When digit 21 is `0`, a sector-1 value of `00` means *no modifier* and is never looked up.
   When digit 21 is `1`, the code `100` **is** looked up — so `…00` + digit 21 = `1` is a real
   modifier (UAV), not "none". **[RAN]**
2. An unknown sector code sets `validIcon = false` but still renders the frame + main icon.

### 7.4 Per-set sector tables — sizes and code ranges **[TSV]**

| Set | Entity rows | Sector-1 rows | Sector-1 code range | Sector-2 rows | Sector-2 code range |
|---|---|---|---|---|---|
| `01` Air | 53 | 41 | `01`–`41` | 12 | `01`–`12` |
| `02` Air missile | 1 | 9 | `01`–`09` | 16 | `01`–`16` |
| `05` Space | 36 | 7 | `01`–`07` | 12 | `01`–`12` |
| `06` Space missile | 1 | 4 | `01`–`04` | 15 | `01`–`15` |
| `10` Land unit | 214 | 99 | `01`–`99` | 89 | `01`–`89` |
| `11` Land civilian | 11 | 26 | `01`–`26` | 2 | `01`–`02` |
| `15` Land equipment | 206 | 27 | `01`–`27` | 10 | `01`–`10` |
| `20` Land installation | 131 | 13 | `01`–`13` | 10 | `01`–`10` |
| `25` Control measure | 628 | 51 | `01`–`51` | 5 | `01`–`05` |
| `27` Dismounted individual | 45 | 34 | `01`–`54` (gaps) | 39 | `01`–`39` |
| `30` Sea surface | 93 | 25 | `01`–`25` | 16 | `01`–`16` |
| `35` Sea subsurface | 22 | 22 | `01`–`22` | 17 | `01`–`17` |
| `36` Mine warfare | 65 | 0 | — | 0 | — |
| `40` Activity/Event | 152 | 22 | `01`–`22` | 2 | `01`–`02` |
| `50`–`54` SIGINT | 4 | 65 | `01`–`65` | 1 | `01` |
| `60` Cyberspace | 43 | 13 | `01`–`13` | 7 | `01`–`08` (gap at `04`) |

Extraction snippet — this is the exact reader semantics the TSVs need (ragged rows, CRLF,
no quoting, a trailing empty header column in `Control Measures.tsv`): **[RAN]**

```js
import fs from "node:fs";
const TSV = "node_modules/milstandard-e/tsv-tables";
function readTSV(file) {
  const raw = fs.readFileSync(`${TSV}/${file}`, "utf8").replace(/^﻿/, "");
  const lines = raw.split(/\r?\n/);
  const header = lines[0].split("\t").map(h => h.trim());
  while (header.length && header.at(-1) === "") header.pop();
  return lines.slice(1).filter(l => l.trim()).map(l => {
    const cells = l.split("\t");
    return Object.fromEntries(header.map((h, j) => [h, (cells[j] ?? "").trim()]));
  });
}
// entities:  readTSV("Land unit.tsv")             -> { Entity, "Entity Type", "Entity Subtype", Code, Remarks }
// sector 1:  readTSV("Land unit sector 1.tsv")    -> { "First Modifier",  Category, Code, Remarks }
// sector 2:  readTSV("Land unit sector 2.tsv")    -> { "Second Modifier", Category, Code, Remarks }
// control m: readTSV("Control Measures.tsv")      -> ... + "Geometric Rendering"
```

Alternatively `import { ms2525e } from "milstandard-e"` gives the whole thing pre-parsed as
`ms2525e[setCode] = { symbolset, name, mainIcon[], modifier1[], modifier2[] }`, plus
`ms2525e.common = { modifier1[], modifier2[] }` — but note `milstandard-e`'s own
`tsv2json.js` **mutates rows in place** to back-fill the hierarchy columns, and its parser
does not right-pad ragged rows, so some `Remarks` come back `undefined`. Reading the TSVs
yourself (above) is more predictable. **[SRC]**

### 7.5 Full Land-unit sector tables

Land unit (`10`) is the highest-volume set; both tables are reproduced verbatim. Every other
set follows the identical shape — pull it with the snippet above.

#### Land unit — Sector 1 (digits 17–18), 99 rows **[TSV]**

| Code | First Modifier | Category | Remarks |
|---|---|---|---|
| `01` | Tactical Satellite Communications | Capability |  |
| `02` | Area | Capability |  |
| `03` | {Disused} |  |  |
| `04` | Biological | Capability |  |
| `05` | Border | Capability |  |
| `06` | {Disused} |  |  |
| `07` | {Disused} |  |  |
| `08` | {Disused} |  |  |
| `09` | {Disused} |  |  |
| `10` | {Disused} |  |  |
| `11` | Communications Contingency Package | Capability |  |
| `12` | Construction | Capability |  |
| `13` | Cross Cultural Communication | Capability |  |
| `14` | {Disused} |  |  |
| `15` | {Disused} |  |  |
| `16` | Detention | Capability |  |
| `17` | Direct Communications | Capability |  |
| `18` | Diving | Capability |  |
| `19` | Division | Support Level |  |
| `20` | Dog | Capability |  |
| `21` | Drilling | Capability |  |
| `22` | Electro–Optical | Capability |  |
| `23` | Enhanced | Capability |  |
| `24` | {Disused} |  |  |
| `25` | Fire Direction Center | Capability |  |
| `26` | Force | Capability |  |
| `27` | Forward | Capability |  |
| `28` | Ground Station Module | Capability |  |
| `29` | Landing Support | Capability |  |
| `30` | {Disused} |  |  |
| `31` | {Disused} |  |  |
| `32` | Meteorological | Capability |  |
| `33` | {Disused} |  |  |
| `34` | Missile | Capability |  |
| `35` | Mobile Advisor and Support | Capability |  |
| `36` | Mobile Subscriber Equipment | Capability |  |
| `37` | Mobility Support | Capability |  |
| `38` | {Disused} |  |  |
| `39` | Multinational | Capability |  |
| `40` | Multinational Specialized Unit | Capability |  |
| `41` | Multiple Rocket Launcher | Capability |  |
| `42` | NATO Medical Role 1 | Capability |  |
| `43` | NATO Medical Role 2 | Capability |  |
| `44` | NATO Medical Role 3 | Capability |  |
| `45` | NATO Medical Role 4 | Capability |  |
| `46` | Naval | Capability |  |
| `47` | Unmanned Aerial Systems (UAS) | Capability |  |
| `48` | {Disused} |  |  |
| `49` | Operations | Capability |  |
| `50` | Radar | Capability |  |
| `51` | Radio Frequency Identification (RFID) Interrogator / Sensor | Capability |  |
| `52` | {Disused} |  |  |
| `53` | {Disused} |  |  |
| `54` | {Disused} |  |  |
| `55` | Sensor | Capability |  |
| `56` | Weapon | Capability |  |
| `57` | Signals Intelligence | Capability |  |
| `58` | {Disused} |  |  |
| `59` | Single Rocket Launcher | Capability |  |
| `60` | Smoke | Capability |  |
| `61` | {Disused} |  |  |
| `62` | Sound Ranging | Capability |  |
| `63` | {Disused} |  |  |
| `64` | {Disused} |  |  |
| `65` | Survey | Capability |  |
| `66` | Tactical Exploitation | Capability |  |
| `67` | Target Acquisition | Capability |  |
| `68` | Topographic/Geospatial | Capability |  |
| `69` | {Disused} |  |  |
| `70` | Video Imagery (Combat Camera) | Capability |  |
| `71` | Mobility Assault | Capability |  |
| `72` | Amphibious Warfare Ship | Capability |  |
| `73` | Load Handling System | Capability |  |
| `74` | Palletized Load System | Capability |  |
| `75` | {Disused} |  |  |
| `76` | {Disused} |  |  |
| `77` | Support | Capability |  |
| `78` | {Disused} |  |  |
| `79` | Route, Reconnaissance, and Clearance | Capability |  |
| `80` | {Disused} |  |  |
| `81` | NATO Medical Role 2 Basic | Capability |  |
| `82` | NATO Medical Role 2 Enhanced | Capability |  |
| `83` | NATO Medical Role Forward | Capability |  |
| `84` | Assault | Capability |  |
| `85` | {Disused} |  |  |
| `86` | Criminal Investigation Division | Capability |  |
| `87` | Digital | Capability |  |
| `88` | Network or Network Operations | Capability |  |
| `89` | Airfield, Aerial Port of Debarkation, or Aerial Port of Embarkation | Capability |  |
| `90` | Pipeline | Capability |  |
| `91` | Postal | Capability |  |
| `92` | {Disused} |  |  |
| `93` | Independent Command | Support Level |  |
| `94` | Theater | Support Level |  |
| `95` | Army or Theater Army | Support Level |  |
| `96` | Corps | Support Level |  |
| `97` | {Disused} |  |  |
| `98` | Headquarters or Headquarters Staff Element |  |  |
| `99` | Multi-Domain Operations | Capability |  |

#### Land unit — Sector 2 (digits 19–20), 89 rows **[TSV]**

| Code | Second Modifier | Category | Remarks |
|---|---|---|---|
| `01` | {Disused} |  |  |
| `02` | Arctic | Mobility |  |
| `03` | Battle Damage Repair | Capability |  |
| `04` | {Disused} |  |  |
| `05` | Casualty Staging | Capability |  |
| `06` | Clearing | Capability |  |
| `07` | {Disused} |  |  |
| `08` | Control | Capability |  |
| `09` | Decontamination | Capability |  |
| `10` | Demolition | Capability |  |
| `11` | Dental | Capability |  |
| `12` | Digital | Capability |  |
| `13` | Enhanced Position Location Reporting System (EPLRS) | Capability |  |
| `14` | Equipment | Capability |  |
| `15` | {Disused} |  |  |
| `16` | High Altitude | Capability |  |
| `17` | Intermodal | Capability |  |
| `18` | Intensive Care | Capability |  |
| `19` | {Disused} |  |  |
| `20` | Laboratory | Capability |  |
| `21` | Launcher | Capability |  |
| `22` | {Disused} |  |  |
| `23` | Low Altitude | Capability |  |
| `24` | {Disused} |  |  |
| `25` | Medium Altitude | Capability |  |
| `26` | {Disused} |  |  |
| `27` | {Disused} |  |  |
| `28` | High to Medium Altitude | Capability |  |
| `29` | Multi–Channel | Capability |  |
| `30` | Optical (Flash) | Capability |  |
| `31` | Pack Animal | Capability |  |
| `32` | Patient Evacuation Coordination | Capability |  |
| `33` | Preventive Maintenance | Capability |  |
| `34` | Psychological | Capability |  |
| `35` | Radio Relay Line of Sight | Capability |  |
| `36` | {Disused} |  |  |
| `37` | Recovery (Unmanned Systems) | Capability |  |
| `38` | Recovery (Maintenance) | Capability |  |
| `39` | Rescue Coordination Center | Capability |  |
| `40` | Riverine | Mobility |  |
| `41` | Single Channel | Capability |  |
| `42` | {Disused} |  |  |
| `43` | {Disused} |  |  |
| `44` | Strategic | Capability |  |
| `45` | Support | Capability |  |
| `46` | Tactical | Capability |  |
| `47` | Towed | Mobility |  |
| `48` | Troop | Capability |  |
| `49` | Vertical or Short Take–Off and Landing (VTOL/VSTOL) | Mobility |  |
| `50` | Veterinary | Capability |  |
| `51` | {Disused} |  |  |
| `52` | High to Low Altitude | Capability |  |
| `53` | Medium to Low Altitude | Capability |  |
| `54` | Attack | Capability |  |
| `55` | Refuel | Capability |  |
| `56` | Utility | Capability |  |
| `57` | Combat Search and Rescue | Capability |  |
| `58` | Guerilla | Capability |  |
| `59` | Air Assault | Mobility |  |
| `60` | Amphibious | Mobility |  |
| `61` | Very Heavy | Capability |  |
| `62` | Supply | Capability |  |
| `63` | {Disused} |  |  |
| `64` | Navy Barge, Self-Propelled | Mobility |  |
| `65` | Navy Barge, Not Self-Propelled | Mobility |  |
| `66` | Launch | Mobility |  |
| `67` | Landing Craft | Mobility |  |
| `68` | Landing Ship | Mobility |  |
| `69` | Service Craft/Yard | Mobility |  |
| `70` | Tug Harbor | Mobility |  |
| `71` | Ocean Going Tug Boat | Mobility |  |
| `72` | Surface Deployment and Distribution Command | Capability |  |
| `73` | Noncombatant Generic Vessel | Mobility |  |
| `74` | Composite | Capability |  |
| `75` | Shelter | Capability |  |
| `76` | {Disused} |  |  |
| `77` | {Disused} |  |  |
| `78` | {Disused} |  |  |
| `79` | {Disused} |  |  |
| `80` | {Disused} |  |  |
| `81` | Surgical | Capability |  |
| `82` | Blood | Capability |  |
| `83` | Combat and Operational Stress Control | Capability |  |
| `84` | Jamming | Capability |  |
| `85` | {Disused} |  |  |
| `86` | Optometry | Capability |  |
| `87` | Preventive Medicine | Capability |  |
| `88` | {Disused} |  |  |
| `89` | Air Defense | Capability |  |

---

## 8. Digits 21–30 — what MIL-STD-2525E added

### 8.1 Digits 21 and 22 — Sector modifier extension (the "hundreds digit")

```js
metadata._modifier1 = (sidc.substr(20,1) || "0") + (functionid.substr(6,2) || "00");
metadata._modifier2 = (sidc.substr(21,1) || "0") + (functionid.substr(8,2) || "00");
```
**[SRC]** `metadata.js:59-64`

Digit 21 is prefixed to digits 17–18 and digit 22 to digits 19–20, producing a **3-digit**
modifier code. `0xx` = the symbol-set's own table; `1xx` = the new **Common Modifiers**
table that 2525E/APP-6E introduced. **[SRC]** `src/numbersidc/sidc/common.js` +
`milstandard-e/tsv-tables/Common Modifiers sector 1.tsv` / `… sector 2.tsv` **[TSV]**

Exhaustive sweep of all 1000 codes per sector: **[RAN]**

| Digit 21 / 22 | Effective code range | Valid codes found |
|---|---|---|
| `0` | `000`–`099` | whatever that symbol set defines (see §7.4) |
| `1` | `100`–`166` (sector 1) | **67** — `100` … `166`, contiguous |
| `1` | `100`–`125` (sector 2) | **26** — `100` … `125`, contiguous |
| `2`–`9` | `200`–`999` | **0** — always `isValid() === false` |

The common table is registered by `common.js`, whose `icons()` function has **no
`symbolSet` guard**, so codes `100`–`166` / `100`–`125` are available on **every** symbol set.
Verified for sets `01,10,15,27,30,35,40,60` — all report 67 / 26 valid. **[RAN]** **[SRC]**

milsymbol also accepts them on **D-edition** version digits: `100310000012110027001000`
(version `10`) still resolves `_modifier1 = "127"` and renders. The extension digits are *not*
gated on `metadata.edition`. **[RAN]**

Worked example: Land-unit Infantry with common Sector-1 `127` (Medevac/Medic/Medical) and
common Sector-2 `104` (Tracked) — digits 17–18 = `27`, digits 19–20 = `04`, digit 21 = `1`,
digit 22 = `1`:

```
140310001612110027041100000000
└┬┘│││└┬┘│││└┬┘└──┬───┘││└┬┘└─┬─┘
 │ │││ │ │││ │    │    │└┤ └┬┘ └── digits 24-30, ignored by milsymbol
 │ │││ │ │││ │    │    │ │  └───── digit 23 frame shape = 0
 │ │││ │ │││ │    │    │ └──────── digit 22 = 1  -> sector 2 = 104
 │ │││ │ │││ │    │    └────────── digit 21 = 1  -> sector 1 = 127
 │ │││ │ │││ │    └─────────────── digits 11-20 = 1211 00 27 04
 │ │││ │ ││└─┴──────────────────── digits 9-10 amplifier = 16 Battalion/squadron
 │ │││ │ │└─────────────────────── digit 8 = 0
 │ │││ │ └──────────────────────── digit 7 = 0 present
 │ │││ └────────────────────────── digits 5-6 = 10 Land unit
 │ ││└──────────────────────────── digit 4 = 3 Friend
 │ │└───────────────────────────── digit 3 = 0 Reality
 └─┴────────────────────────────── digits 1-2 = 14 APP-6E
```
`_modifier1 = "127"`, `_modifier2 = "104"`, `echelon = "Battalion/squadron"`,
`isValid() === true`, 63.2 × 59.2 px, 748-byte SVG. **[RAN]**

#### Common Modifiers — Sector 1 (digit 21 = `1`), codes `100`–`166` **[TSV]**

| Code | First Modifier | Category | Remarks |
|---|---|---|---|
| `100` | Unmanned Aircraft (UA)/ Unmanned Aerial Vehicle (UAV)/ Unmanned Aircraft System (UAS)/ Remote Piloted Vehicle (RPV) | Mobility |  |
| `101` | Robotic | Mobility |  |
| `102` | Fixed Wing | Mobility | Not used by USAF |
| `103` | Rotary Wing | Mobility |  |
| `104` | Tilt-Rotor | Mobility |  |
| `105` | VSTOL/VTOL or Helicopter Equipped | Mobility |  |
| `106` | Attack or Attack/Strike | Capability |  |
| `107` | Armored | Capability |  |
| `108` | Ballistic Missile/Ballistic Missile Defense Shooter | Capability |  |
| `109` | Bridge/Bridging | Capability |  |
| `110` | Cargo | Capability |  |
| `111` | Utility | Capability |  |
| `112` | Light | Capability |  |
| `113` | Medium | Capability |  |
| `114` | Heavy | Capability |  |
| `115` | Cyberspace | Capability |  |
| `116` | Command Post Node | Capability |  |
| `117` | Joint Network Node | Capability |  |
| `118` | Retransmission Site | Capability |  |
| `119` | Brigade | Support Level |  |
| `120` | Close Protection | Capability |  |
| `121` | Combat | Capability |  |
| `122` | Command and Control | Capability |  |
| `123` | Crowd and Riot Control | Capability |  |
| `124` | Explosive Ordnance Disposal | Capability |  |
| `125` | Intelligence Surveillance Reconnaissance | Capability |  |
| `126` | Maintenance | Capability |  |
| `127` | Medevac/Medic/Medical | Capability |  |
| `128` | Search and Rescue | Capability |  |
| `129` | Security | Capability |  |
| `130` | Sniper | Capability |  |
| `131` | Special Operations Forces | Capability |  |
| `132` | Special Weapons and Tactics (SWAT) | Capability |  |
| `133` | Guided Missile | Capability |  |
| `134` | Other Guided Missile | Capability |  |
| `135` | Petroleum/Petroleum Oil and Lubricants | Capability |  |
| `136` | Water | Capability |  |
| `137` | Weapon or Weapons | Capability |  |
| `138` | Chemical | CBRN |  |
| `139` | Biological | CBRN |  |
| `140` | Radiological | CBRN |  |
| `141` | Nuclear | CBRN |  |
| `142` | Decontamination | CBRN |  |
| `143` | Civilian | Organization |  |
| `144` | Government Organization / Government Organization Member | Organization |  |
| `145` | Accident | Composite Loss or Incident Qualifier |  |
| `146` | Assassination | Crime |  |
| `147` | Execution | Crime |  |
| `148` | Kidnapping | Crime |  |
| `149` | Piracy | Crime |  |
| `150` | Rape | Crime |  |
| `151` | Antisubmarine Warfare | Mission Area |  |
| `152` | Escort | Mission Area |  |
| `153` | Mine Countermeasures | Mission Area |  |
| `154` | Mine Warfare | Mission Area | APP-06 uses ‘MW’ |
| `155` | Surface Warfare | Mission area |  |
| `156` | Command | Support Level |  |
| `157` | Company | Support Level |  |
| `158` | Platoon/Detachment | Support Level |  |
| `159` | Regiment Group | Support Level |  |
| `160` | Section | Support Level |  |
| `161` | Squad | Support Level |  |
| `162` | Team/Crew | Support Level |  |
| `163` | Battalion | Support Level |  |
| `164` | Directed Energy | Capability |  |
| `165` | Hijacker | Crime |  |
| `166` | Electromagnetic | Capability |  |

#### Common Modifiers — Sector 2 (digit 22 = `1`), codes `100`–`125` **[TSV]**

| Code | Second Modifier | Category | Remarks |
|---|---|---|---|
| `100` | Airborne | Mobility |  |
| `101` | Bicycle Equipped | Mobility |  |
| `102` | Railroad/Railway | Capability |  |
| `103` | Ski | Mobility |  |
| `104` | Tracked | Mobility |  |
| `105` | Wheeled (Limited Cross Country) | Mobility |  |
| `106` | Wheeled X (Cross Country) | Mobility |  |
| `107` | Fixed Wing | Mobility |  |
| `108` | Rotary Wing | Mobility |  |
| `109` | Robotic | Mobility |  |
| `110` | Autonomous Control | Capability |  |
| `111` | Remotely Piloted | Capability |  |
| `112` | Expendable | Capability |  |
| `113` | Mountain | Capability |  |
| `114` | Long Range | Capability |  |
| `115` | Medium Range | Capability |  |
| `116` | Short Range | Capability |  |
| `117` | Close Range | Capability |  |
| `118` | Heavy | Capability |  |
| `119` | Medium | Capability |  |
| `120` | Light and Medium | Capability |  |
| `121` | Light | Capability |  |
| `122` | Cyberspace | Capability |  |
| `123` | Security Force Assistance | Capability |  |
| `124` | Medical Bed | Capability |  |
| `125` | Multifunctional | Capability |  |

milsymbol's `common.js` registers exactly 67 sector-1 and 26 sector-2 icons, a 1:1 match with
the two TSVs above. Two naming differences worth noting: code `164` is
`COM.MQ.LASER` in milsymbol vs *Directed Energy* in the TSV, and code `166` is
`COM.M1.ELECTROMAGNETIC WARFARE` vs *Electromagnetic*. **[SRC]** **[TSV]**

### 8.2 Digit 23 — Frame-shape override

```js
const frameshape = this.options.sidc.substr(22, 1) || "0";
…
if (frameshape != "0" && metadata.edition == "E") {
  metadata.civilian = metadata.cyberspace = metadata.installation =
  metadata.landequipment = metadata.activity = metadata.space = metadata.unit = false;
  switch (frameshape) { … }
}
if (frameshape == "A") metadata.frame = false;
```
**[SRC]** `metadata.js:11, 169-218`

Measured on a Land-unit Infantry Friend (`13`…`10`…`1211000000` + `00` + digit 23): **[RAN]**

| d23 | Comment in source | `dimension` | Flags set | Base geometry changed? | Notes |
|---|---|---|---|---|---|
| `0` | *(no override)* | `Ground` | `unit` (from the set) | no | default |
| `1` | Space | `Air` | `space` | **yes** → `AirFriend` | air frame + space arc cap |
| `2` | Air | `Air` | *(none)* | **yes** → `AirFriend` | |
| `3` | Land Unit | `Ground` | `unit` | no | |
| `4` | Land Equipment / Sea Surface | `Sea` | `landequipment` | **yes** → `SeaFriend` (circle) | |
| `5` | Land Installation | `Ground` | `installation` | no | |
| `6` | Dismounted Individuals | `LandDismountedIndividual` | `dismounted` | **yes** → hexagon | |
| `7` | Sea Subsurface | `Subsurface` | *(none)* | **yes** → `SubsurfaceFriend` | |
| `8` | Activity/Event | `Ground` | `activity`, `unit` | no | |
| `9` | Cyberspace | `Ground` | `unit`; **`cyberspace = false`** | no | **bug** — see below |
| `A` | *(unframed)* | unchanged `Ground` | **all cleared**, `frame = false` | no | works in **any** edition |
| `B`–`Z`, other | *(unhandled)* | unchanged `Ground` | **all cleared**, nothing set | no | silently strips `unit`/`space`/… |

Three gotchas, all proved: **[RAN]**

1. **The override is edition-gated.** With version `10`/`11`/`12` (edition D) or an unknown
   version like `15`, digit 23 = `4` does nothing at all — `dimension` stays `Ground`. Only
   `A` (unframed) leaks through, because that line sits *outside* the `edition == "E"` block.
2. **Any unrecognised digit-23 value is destructive.** The seven flag resets run *before* the
   `switch`, so digit 23 = `B` turns a Land unit into a frame with `unit === false` — no
   activity/installation/space decoration, and echelon glyph spacing changes.
3. **`case "9"` sets `metadata.cyberspace = false`, not `true`** (`metadata.js:213`). A
   cyberspace frame-shape override therefore draws a *plain ground unit frame* with no
   cyberspace tail. Almost certainly a typo in milsymbol 3.0.4. Work around it by setting
   `symbol.metadata.cyberspace = true` after construction, or by using symbol set `60`.

### 8.3 Digits 24–30 — and the conflict over 21–23

**What milsymbol does: nothing.** `grep -rn "options\.sidc\.substr" src/` returns every SIDC
read in the library; the largest offset for number-based SIDCs is `substr(22,1)`. A 30-digit
SIDC and the same SIDC truncated to 23 digits render byte-identically. **[SRC]** **[RAN]**

**What the published standards say.** Both APP-6(D)(1)/APP-6(E) and MIL-STD-2525E describe
the *third ten digits* (21–30) as an **optional national-extension block**, not as modifier
extensions: **[DOC]**

* Digits **21–23**: *Symbology Originator Identifier* — a three-digit nation code sourced
  from ISO 3166.
* Digits **24–30**: content defined by that originator; not interoperable.
* Activation requires a **Version Extension Flag (VEF)** of `9` or `99` placed somewhere in
  the first 20 digits.
* MIL-STD-2525D's own wording: *"eleven elements of information which are presented in two
  sets of ten digits. An additional set of ten digits composed of three elements must be used
  when a symbology originator version extension flag is used."*

A UK change proposal (18-002-UK, tracked as Esri/joint-military-symbology-xml issue #492)
proposed making digits 21–30 mandatory and re-cutting them as
*country code / Sector-1 Modifier Extension Flag / Sector-2 Modifier Extension Flag /
Geographic Entity* — which is recognisably the ancestor of what milsymbol implements. **[DOC]**

**[GAP] — unresolved.** I could not obtain the MIL-STD-2525E text itself (the one mirror
found returns HTTP 403, and `mapsymbs.com` fails TLS negotiation), so I cannot state which
reading the published 2525E adopted. What *is* certain:

| Claim | Status |
|---|---|
| milsymbol 3.0.4 reads digit 21 as Sector-1 hundreds digit, 22 as Sector-2 hundreds digit, 23 as frame shape | **[SRC]** **[RAN]** — certain |
| milsymbol ignores digits 24–30 | **[SRC]** **[RAN]** — certain |
| `milstandard-e`'s "Common Modifiers" tables really do use 3-digit codes `100`+ | **[TSV]** — certain |
| The published APP-6(D)(1)/2525E text describes 21–23 as an ISO-3166 originator code | **[DOC]** — multiple concurring secondary sources |
| Which of the two readings 2525E normatively adopted | **[GAP]** |

> **Recommendation:** the plugin should emit digits 21–23 using **milsymbol's** reading
> (that is what will actually render), pad digits 24–30 with `0`, and expose the produced
> SIDC as "milsymbol-compatible 2525E/APP-6E". Do not claim wire-compatibility with a
> national-extension consumer without checking the specific system's reading of 21–30.
> The safest interchange form is the plain **20-digit** SIDC, which both readings agree on.

---

## 9. Validation — what makes a SIDC invalid, and what `isValid()` actually tests

### 9.1 Normalisation, applied before anything else **[SRC]** `getmetadata.js:86-90`

```js
this.options.sidc = String(this.options.sidc).replace(/\*/g, "-").replace(/ /g, "");
metadata.numberSIDC = !isNaN(this.options.sidc.substr(0, 2));
```

* `*` → `-`, all spaces stripped. `"14 03 10 00 00 1211 00 00 00"` is accepted and valid. **[RAN]**
* The **number-vs-letter decision is made on the first two characters only**:
  `!isNaN(sidc.substr(0,2))`. `"10A3100000"` parses as a *number* SIDC; `"1-03…"` parses as a
  *letter* SIDC. **[RAN]**
* There is **no length check anywhere**. Short SIDCs are padded implicitly by `substr`
  returning `""`.

### 9.2 `isValid()` source **[SRC]** `src/ms/symbol/isvalid.js`

```js
export default function isValid(extended) {
  const drawInstructions = JSON.stringify(this.drawInstructions).indexOf("null") == -1;
  if (extended) {
    return { affiliation: this.metadata.affiliation,
             dimension: this.metadata.dimension,
             dimensionUnknown: this.metadata.dimensionUnknown,
             drawInstructions, icon: this.validIcon,
             mobility: this.metadata.mobility != undefined };
  }
  return !(this.metadata.affiliation == "undefined" ||
           (this.metadata.dimension == "undefined" && !this.metadata.controlMeasure))
         && drawInstructions && this.validIcon && this.metadata.mobility != undefined;
}
```

Four independent conditions:

| Condition | Fails when |
|---|---|
| `affiliation != "undefined"` | compares to the **string** `"undefined"`, the `getMetadata()` seed value. Only fails if no SIDC handler ran at all. |
| `dimension != "undefined" \|\| controlMeasure` | likewise the string seed; control measures are exempted because their dimension is `""` |
| `drawInstructions` has no `null` | a symbol part pushed `undefined`/`null` into the draw list |
| `validIcon` | `icon.js` set it false: unknown entity code, or unknown sector-1/sector-2 code |
| `mobility != undefined` | digits 9–10 hit the `>= 30 && < 70` branch with no table entry |

`isValid(true)` returns the per-condition breakdown — use it for a UI error message.

### 9.3 Measured behaviour **[RAN]** (`research/scratch/sidc-J-validation.mjs`)

| SIDC | len | `isValid()` | Failing condition |
|---|---|---|---|
| `14031000001211000000` | 20 | **true** | — |
| `140310000012110000001100` | 24 | **true** | — (digits 21–24 = `1`,`1`,`0`,`0`) |
| `140310000012110000000000000000` | 30 | **true** | — |
| `1403100000121100` | 16 | **false** | `icon` (entity `1100` + `""` → `""`) |
| `14031000` | 8 | **false** | `icon` |
| `14` | 2 | **false** | `icon`; `dimension` empty |
| `""` | 0 | **false** | `icon` |
| `1403100000121100000X` | 20 | **false** | `icon` — sector-2 `0X` not in table |
| `14 03 10 00 00 1211 00 00 00` | 20→ | **true** | spaces stripped |
| `14*31000001211000000` | 20 | **true** | `*`→`-`; `-3` parses as context/affiliation `-`/`3` |
| `SFGPUCI----D` | 12 | **true** | routed to the letter-SIDC handler |
| `14071000001211000000` | 20 | **true** ⚠ | **affiliation is `undefined`** yet it passes — see below |
| `14039900001211000000` | 20 | **false** | `dimension === ""`, `icon` false |
| `14031000001199000000` | 20 | **false** | `icon` — no entity `119900` |
| `14031000301211000000` | 20 | **false** | `mobility === undefined` |
| `14031000381211000000` | 20 | **false** | `mobility === undefined` |

> **Known milsymbol bug — the `"undefined"` string comparison.** Standard identity digits
> `7`, `8`, `9` produce `metadata.affiliation === undefined` (the JS value). `isValid()`
> compares against the *string* `"undefined"`, so `undefined == "undefined"` is `false` and
> the check passes. `14071000001211000000` reports **valid** while drawing a frameless,
> colourless symbol. **The plugin must range-check digits 3 and 4 itself.** **[RAN]**

### 9.4 The validation the plugin should do (milsymbol will not)

```js
const RE = /^\d{20}(\d{10})?$/;                  // 20 or 30 digits, nothing else
function validateSIDC(s) {
  const e = [];
  if (!RE.test(s)) e.push("SIDC must be exactly 20 or 30 digits");
  const [ver, ctx, si, set, st, hq, amp] =
    [s.slice(0,2), s[2], s[3], s.slice(4,6), s[6], s[7], s.slice(8,10)];
  if (!["10","11","12","13","14"].includes(ver)) e.push(`version ${ver} unknown`);
  if (!"012".includes(ctx))                      e.push(`context ${ctx} illegal`);
  if (!"0123456".includes(si))                   e.push(`standard identity ${si} illegal`);
  if (!SYMBOL_SETS.has(set))                     e.push(`symbol set ${set} unknown`);
  if (!"012345".includes(st))                    e.push(`status ${st} illegal`);
  if (!"01234567".includes(hq))                  e.push(`hq/tf/dummy ${hq} illegal`);
  if (!AMPLIFIERS.has(amp))                      e.push(`amplifier ${amp} illegal`);
  if (s.length === 30) {
    if (!"01".includes(s[20])) e.push("digit 21 (sector-1 extension) must be 0 or 1");
    if (!"01".includes(s[21])) e.push("digit 22 (sector-2 extension) must be 0 or 1");
    if (!"0123456789A".includes(s[22])) e.push("digit 23 (frame shape) must be 0-9 or A");
  }
  return e;
}
const AMPLIFIERS = new Set(["00","11","12","13","14","15","16","17","18",
  "21","22","23","24","25","26","31","32","33","34","35","36","37",
  "41","42","51","52","61","62","71","72"]);
const SYMBOL_SETS = new Set(["00","01","02","05","06","10","11","15","20","25","27",
  "30","35","36","40","50","51","52","53","54","60"]);
```
Then *additionally* call `new ms.Symbol(sidc).isValid(true)` to catch unknown entity and
sector codes, which only the icon tables know about.

---

## 10. Worked examples — decoded and rendered

Every row below was constructed, rendered with `new ms.Symbol(sidc, {size: 40}).asSVG()` and
its metadata dumped. Entity names come from the milstandard-e TSVs.
Script: `research/scratch/sidc-K-final-examples.mjs`. **[RAN]** **[TSV]**

### 10.1 `14031000141211020000` — Land unit (set `10`)

| Digits | Value | Decoded |
|---|---|---|
| 1–2 | `14` | APP-6E (edition `E`) |
| 3 | `0` | Reality |
| 4 | `3` | Friend |
| 5–6 | `10` | Land unit → dimension `Ground`, `unit = true` |
| 7 | `0` | Present |
| 8 | `0` | no HQ / TF / dummy |
| 9–10 | `14` | echelon **Platoon/detachment** |
| 11–16 | `121102` | Infantry ▸ *Armored/Mechanized/Tracked* |
| 17–18 | `00` | no Sector-1 modifier |
| 19–20 | `00` | no Sector-2 modifier |

Result: `isValid() true`, `affiliation Friend`, `dimension Ground`,
`echelon "Platoon/detachment"`, 63.2 × 54.2 px, **719-byte** SVG.

### 10.2 `14060100001101020000` — Air (set `01`)

`14` APP-6E · `0` Reality · `6` **Hostile** · `01` Air · `0` Present · `0` · `00` ·
`110102` Military ▸ Fixed Wing ▸ *Attack/Strike* · `00` · `00`

→ `dimension Air`, `affiliation Hostile` (pointed-roof air frame
`M 45,150 L45,70 100,20 155,70 155,150`), no dash,
47.2 × 55.2 px, **436-byte** SVG. `isValid() true`.

### 10.3 `14033000001201000000` — Sea surface (set `30`)

`14` · `0` · `3` Friend · `30` Sea surface · `0` · `0` · `00` ·
`120100` Military Combatant ▸ *Carrier* · `00` · `00`

→ `dimension Sea` (circle frame, r = 60), 51.2 × 51.2 px, **351-byte** SVG. `isValid() true`.

### 10.4 `14063510001101000000` — Sea subsurface (set `35`), planned

`14` · `0` · `6` Hostile · `35` Sea subsurface · **`1` Planned** · `0` · `00` ·
`110100` Military ▸ *Submarine* · `00` · `00`

→ `dimension Subsurface`, **`notpresent = "8,12"`** so the frame is redrawn dashed
`8,12`. 47.2 × 55.2 px, **501-byte** SVG. `isValid() true`.

### 10.5 `14031500331201030000` — Land equipment (set `15`), tracked

`14` · `0` · `3` Friend · `15` Land equipment · `0` · `0` · **`33` mobility Tracked** ·
`120103` Vehicle ▸ Armored ▸ *Armored Personnel Carrier* · `00` · `00`

→ note the dimension override: `baseDimension = "Ground"` but
**`dimension = "Sea"`** (`metadata.js:153-154`), so the frame is the *Sea Friend circle*.
`mobility = "Tracked"` adds the wheel/track glyph below the frame.
54.4 × 58.4 px, **580-byte** SVG. `isValid() true`.

### 10.6 `14042030001101000000` — Land installation (set `20`), damaged

`14` · `0` · **`4` Neutral** · `20` Land installation · **`3` Damaged** · `0` · `00` ·
`110100` Military/Civilian ▸ *Aircraft Production/Assembly* · `00` · `00`

→ `condition = "Damaged"` → condition bar filled `rgb(255,255,0)`, frame height grows from
47.2 to **63.2 px**. `installation = true` adds the installation flag.
**759-byte** SVG. `isValid() true`.

### 10.7 `14064000001101020000` — Activity/Event (set `40`)

`14` · `0` · `6` Hostile · `40` Activity/Event · `0` · `0` · `00` ·
`110102` Incident ▸ Criminal Activity Incident ▸ *Arson* · `00` · `00`

→ `activity = true` adds the four corner diamonds to the hostile frame.
60.8 × 60.8 px, **1235-byte** SVG. `isValid() true`.

### 10.8 `14036000001101000000` — Cyberspace (set `60`)

`14` · `0` · `3` Friend · `60` Cyberspace · `0` · `0` · `00` ·
`110100` Cyberspace Unit ▸ *Combat Mission Team* · `00` · `00`

→ `cyberspace = true` adds the lower-right tail `m 135,150 40,-40 0,40 z` to the Friend
rectangle, so width grows to **63.2** px against a 43.2 px height.
**515-byte** SVG. `isValid() true`.

### 10.9 `14032700711102010000` — Dismounted individual (set `27`), leader

`14` · `0` · `3` Friend · `27` Dismounted individual · `0` · `0` ·
**`71` leadership Leader Individual** ·
`110201` Military ▸ Activity/Task ▸ *Explosive Ordnance Disposal* · `00` · `00`

→ `dimension = "LandDismountedIndividual"` (hexagon frame), `dismounted = true`,
`leadership = "Leader Individual"` → chevron `m 45,60 55,-25 55,25` over the frame.
47.2 × 55.2 px, **526-byte** SVG. `isValid() true`.
Note `baseDimension` is `""` because the dismounted override runs before it is saved.

### 10.10 `14030500001101000000` — Space (set `05`)

`14` · `0` · `3` Friend · `05` Space · `0` · `0` · `00` ·
`110100` Military ▸ *Space Vehicle* · `00` · `00`

→ `dimension Air` + `space = true` → Friend air frame plus the space cap
`M 100,30 C 90,30 80,35 68.65625,50 l 62.6875,0 C 120,35 110,30 100,30`.
47.2 × 51.2 px, **583-byte** SVG. `isValid() true`.

### 10.11 `14032500001301000000` — Control measure (set `25`), point

`14` · `0` · `3` Friend · `25` Control measure · `0` · `0` · `00` ·
`130100` Command and Control Points ▸ *Action Point (General)* (`Geometric Rendering = Point`)
· `00` · `00`

→ `controlMeasure = true`, `dimension = ""` (no frame at all — the `isValid()` exemption
applies), custom bbox `{x1:60, x2:140, y1:-60}`. 35.2 × 67.2 px, **242-byte** SVG.
`isValid() true`.
Contrast `14032500001101000000` (entity `110100` *Boundary*, `Geometric Rendering = Line`):
**`isValid() false`** — milsymbol has no icon for line-type control measures. **[RAN]**

### 10.12 `140310001612110027041100000000` — 30-digit with Common Modifiers

| Digits | Value | Decoded |
|---|---|---|
| 1–2 | `14` | APP-6E |
| 3–4 | `0`,`3` | Reality, Friend |
| 5–6 | `10` | Land unit |
| 7–8 | `0`,`0` | Present, none |
| 9–10 | `16` | echelon **Battalion/squadron** |
| 11–16 | `121100` | *Infantry* |
| 17–18 | `27` | Sector-1 low digits |
| 19–20 | `04` | Sector-2 low digits |
| 21 | `1` | Sector-1 extension → `_modifier1 = "127"` = **Medevac/Medic/Medical** |
| 22 | `1` | Sector-2 extension → `_modifier2 = "104"` = **Tracked** |
| 23 | `0` | no frame-shape override |
| 24–30 | `0000000` | ignored by milsymbol |

Result: `isValid() true`, `_modifier1 "127"`, `_modifier2 "104"`,
`echelon "Battalion/squadron"`, 63.2 × 59.2 px, **748-byte** SVG.

### 10.13 `14151000001211000000` — Exercise **Joker**

`14` · **`1` Exercise** · **`5` Suspect** · `10` Land unit · `0` · `0` · `00` ·
`121100` *Infantry* · `00` · `00`

→ `joker = true`, `baseAffilation = "Hostile"`, **`affiliation = "Friend"`** (so the frame
is the Friend *rectangle*), frame colours repainted hostile red, `notpresent = "4,4"`
(dashed), and a bold **`J`** drawn to the right of the frame.
76 × 57.2 px, **614-byte** SVG. `isValid() true`.
With version `13` instead of `14`, the same symbol comes out **Suspect amber**
`rgb(255, 229, 153)` rather than hostile red. **[RAN]**

---

## 11. milsymbol 3.0.4 quirks the plugin must work around

| # | Quirk | Evidence | Work-around |
|---|---|---|---|
| 1 | `metadata.suspect` is gated on `version == 13`, so APP-6E version `14` never gets Suspect colouring | `metadata.js:30` **[SRC]**, colour diff **[RAN]** | emit `13`, or set `symbol.metadata.suspect = true` and re-read colours |
| 2 | `isValid()` compares `affiliation` against the **string** `"undefined"`, so standard identity `7`/`8`/`9` passes validation while drawing nothing | `isvalid.js:17` **[SRC]** **[RAN]** | range-check digits 3–4 yourself |
| 3 | Frame-shape `case "9"` (Cyberspace) assigns `metadata.cyberspace = false` | `metadata.js:213` **[SRC]** **[RAN]** | set the flag manually, or use symbol set `60` |
| 4 | Any unhandled digit-23 value (`B`…`Z`) still clears `unit`/`space`/`installation`/… | `metadata.js:170-178` **[SRC]** **[RAN]** | validate digit 23 ∈ `0-9A` |
| 5 | Amplifier `30` sets *both* `echelon` and `mobility` to `undefined`; `38`–`69` unmapped values set `mobility = undefined` → invalid | `metadata.js:229-234` **[SRC]** **[RAN]** | use the whitelist in §9.4 |
| 6 | `Leader Individual` and `Deputy Individual` render identically; leadership chevron draws **only** for Friend | `modifier.js:621-638` **[SRC]** | accept, or post-draw |
| 7 | Digits 1–2 do **not** select NATO vs US glyphs — `ms._STD2525` defaults to `true` (US) | `ms.js:77`, `getmetadata.js:79-81` **[SRC]** **[RAN]** | always pass `{ standard: "APP6" }` |
| 8 | `FrameColor.Suspect` is the typo `"rbg(255, 188, 1)"` | `colormodes.js` **[SRC]** | avoid `style.frameColor` object mode for Suspect |
| 9 | Extension digits 21/22 are honoured even on edition-D versions | **[RAN]** | validate yourself if strictness matters |
| 10 | Only **point** control measures render (264 of 628 catalog entries) | **[RAN]** | filter on the `Geometric Rendering` column |
| 11 | `metadata.dimensionMapping` contains sets `12` and `39` that have no icon catalog and appear in no TSV | `metadata.js:42,48` **[SRC]** **[RAN]** | exclude from the picker |

---

## 12. Reproducing every result here

```
cd .
node research/scratch/version2.mjs             # §2.2  version digits, D-vs-E SVG diff
node research/scratch/probe2.mjs               # §3,§5 context / SI / status / hq-tf-dummy sweeps
node research/scratch/probe1.mjs               # §6    amplifier 00-99 exhaustive sweep
node research/scratch/sidc-A-symbolsets.mjs    # §4    symbol set 00-99 sweep
node research/scratch/sidc-B-frameshape.mjs    # §8.2  frame-shape digit 23
node research/scratch/sidc-C-modext.mjs        # §8.1  modifier extension digits 21-22
node research/scratch/sidc-D-stdcompare.mjs    # §2.2  2525-vs-APP6 render diff
node research/scratch/sidc-E-counts.mjs        # §7.4  TSV row counts and code ranges
node research/scratch/sidc-F-subtype95.mjs     # §7.2  entity subtype 95-98
node research/scratch/sidc-G-examples.mjs      # §10   (superseded by sidc-K)
node research/scratch/sidc-H-coverage.mjs      # §4.4  entity coverage per set
node research/scratch/sidc-I-visual.mjs        # §5    visual feature measurements
node research/scratch/sidc-J-validation.mjs    # §9.3  validation behaviour
node research/scratch/sidc-K-final-examples.mjs# §10   worked examples
```

### Public sources consulted (all **[DOC]**, none locally verifiable)

- [Esri/joint-military-symbology-xml issue #492 — "18-002-UK SIDC Third Ten Digits Use"](https://github.com/Esri/joint-military-symbology-xml/issues/492)
- [psylsph/milsymbol-sidc — TypeScript SIDC builder for 2525E/APP-6](https://github.com/psylsph/milsymbol-sidc)
- [d0707de7/sidc (Go) — version-digit detection rules](https://pkg.go.dev/github.com/d0707de7/sidc)
- [Carmenta — SIDC identifiers in MIL-STD-2525D](https://docs.carmenta.com/pages/milstd2525d_tactical_sidc.html)
- [Carmenta — SIDC identifiers in App6D](https://docs.carmenta.com/pages/app6d_tactical_sidc.html)
- [FreeTAKServer docs — About MIL-STD-2525 and CoT](https://freetakteam.github.io/FreeTAKServer-User-Docs/About/architecture/mil_std_2525/)
- [spatialillusions/milsymbol](https://github.com/spatialillusions/milsymbol)

The MIL-STD-2525E PDF itself could not be retrieved (`img.antpedia.com` → HTTP 403;
`mapsymbs.com` → TLS handshake failure), so **no claim in this document is sourced from the
standard's own text**.
