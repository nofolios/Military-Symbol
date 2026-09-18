# The APP-6E SIDC, for people who just want the right symbol

A **SIDC** (Symbol Identification Code) is the 30-character code that says what a symbol is. It
is all digits, with one exception: position 23 may be the letter `A` for an unframed symbol. The
plugin builds one for you from the controls on the Build tab, but it is worth being able to read
one: SIDCs are what you paste into the Batch tab and into an ORBAT outline, what gets stored on
every inserted layer, and what other APP-6E tools exchange.

Every code printed in this document was rendered through the plugin's renderer before it was
written down: each one is structurally valid, draws a real icon rather than a bare frame, and
round-trips through the plugin unchanged.

---

## 1. The 30 digits

```
 14 0 3 10 0 0 15 121100 00 00 0 1 0 0000000
 │  │ │ │  │ │ │  │      │  │  │ │ │ └─ 24-30 reserved
 │  │ │ │  │ │ │  │      │  │  │ │ └─── 23    frame shape override
 │  │ │ │  │ │ │  │      │  │  │ └───── 22    sector 2 modifier, high digit
 │  │ │ │  │ │ │  │      │  │  └─────── 21    sector 1 modifier, high digit
 │  │ │ │  │ │ │  │      │  └────────── 19-20 sector 2 modifier, low digits
 │  │ │ │  │ │ │  │      └───────────── 17-18 sector 1 modifier, low digits
 │  │ │ │  │ │ │  └──────────────────── 11-16 entity / type / subtype
 │  │ │ │  │ │ └─────────────────────── 9-10  amplifier (echelon, mobility, …)
 │  │ │ │  │ └───────────────────────── 8     HQ / task force / dummy
 │  │ │ │  └─────────────────────────── 7     status
 │  │ │ └────────────────────────────── 5-6   symbol set
 │  │ └──────────────────────────────── 4     standard identity 2 — affiliation
 │  └────────────────────────────────── 3     standard identity 1 — context
 └───────────────────────────────────── 1-2   version
```

| Positions | Field | Width |
|---|---|---|
| 1–2 | Version / standard edition | 2 |
| 3 | Standard identity 1 — context | 1 |
| 4 | Standard identity 2 — affiliation | 1 |
| 5–6 | Symbol set | 2 |
| 7 | Status / operational condition | 1 |
| 8 | Headquarters / task force / dummy | 1 |
| 9–10 | Amplifier / descriptor | 2 |
| 11–12 | Entity | 2 |
| 13–14 | Entity type | 2 |
| 15–16 | Entity subtype | 2 |
| 17–18 | Sector 1 modifier — low digits | 2 |
| 19–20 | Sector 2 modifier — low digits | 2 |
| 21 | Sector 1 modifier — high digit | 1 |
| 22 | Sector 2 modifier — high digit | 1 |
| 23 | Frame shape override | 1 |
| 24–30 | Reserved (always zeros) | 7 |

Positions 1–20 are the old 20-digit D-edition layout, which is why a D-edition code can be
pasted into the plugin and simply gets ten zeros appended. Positions 21–30 are new in the E
editions.

**The awkward bit: sector modifiers are three digits split in two.** A modifier code such as
`100` (*Airborne*, land units) puts its **last two digits at positions 17–18** (sector 1) or
**19–20** (sector 2), and its **first digit at position 21** (sector 1) or **22** (sector 2).
So `100` in sector 2 is written `…00…1…` — low digits `00` at 19–20 and high digit `1` at 22.
The plugin's pickers and its parser handle this for you; you only need to know it when reading
a raw code by eye.

---

## 2. Every enumeration

### Version (positions 1–2)

| Code | Meaning |
|---|---|
| `10` | MIL-STD-2525D |
| `11` | STANAG APP-6D |
| `13` | MIL-STD-2525E |
| `14` | **STANAG APP-6E — what this plugin emits** |

Versions `13` and `14` describe the same edition; they differ only in which nation's document
you are quoting. Which glyphs get drawn is decided by the *Standard* setting in the plugin, not
by these digits.

### Standard identity 1 — context (position 3)

| Code | Meaning |
|---|---|
| `0` | Reality |
| `1` | Exercise |
| `2` | Simulation |

Exercise adds a letter beside the frame. Exercise combined with Suspect or Hostile produces a
**joker** or **faker**: a friendly frame *shape* painted in hostile colours, so an exercise
opponent is never mistaken for a real one.

### Standard identity 2 — affiliation (position 4)

| Code | Meaning | Frame shape | Dashed? |
|---|---|---|---|
| `0` | Pending | quatrefoil (unknown) | yes |
| `1` | Unknown | quatrefoil | no |
| `2` | Assumed Friend | rectangle (friend) | yes |
| `3` | Friend | rectangle | no |
| `4` | Neutral | square | no |
| `5` | Suspect / Joker | diamond (hostile) | yes |
| `6` | Hostile / Faker | diamond | no |

The dashed identities are the "not confirmed yet" ones. Suspect is drawn amber rather than red
in the E editions.

### Symbol set (positions 5–6)

| Code | Symbol set | Code | Symbol set |
|---|---|---|---|
| `01` | Air | `27` | Dismounted Individual |
| `02` | Air Missile | `30` | Sea Surface |
| `05` | Space | `35` | Sea Subsurface |
| `06` | Space Missile | `36` | Mine Warfare |
| `10` | Land Unit | `40` | Activity / Event |
| `11` | Land Civilian Unit / Organisation | `50` | SIGINT — Space |
| `15` | Land Equipment | `51` | SIGINT — Air |
| `20` | Land Installation | `52` | SIGINT — Land |
| `25` | Control Measure | `53` | SIGINT — Surface |
| | | `54` | SIGINT — Subsurface |
| | | `60` | Cyberspace |

The symbol set decides the frame family (air, land, sea, subsurface, space) **and** the meaning
of the entity digits: `121100` is *Infantry* in set `10` and something else entirely in set `15`.
Sets `02` and `06` carry a single entity each; sets `50`–`54` carry four each.

### Status / operational condition (position 7)

| Code | Meaning | Drawn as |
|---|---|---|
| `0` | Present | nothing |
| `1` | Planned / Anticipated / Suspect | dashed frame |
| `2` | Present — Fully Capable | condition bar |
| `3` | Present — Damaged | condition bar |
| `4` | Present — Destroyed | condition bar |
| `5` | Present — Full to Capacity | condition bar |

### Headquarters / task force / dummy (position 8)

Three independent flags packed into one digit: feint/dummy = 1, headquarters = 2,
task force = 4.

| Code | Meaning |
|---|---|
| `0` | Not applicable |
| `1` | Feint / Dummy |
| `2` | Headquarters |
| `3` | Feint / Dummy Headquarters |
| `4` | Task Force |
| `5` | Feint / Dummy Task Force |
| `6` | Task Force Headquarters |
| `7` | Feint / Dummy Task Force Headquarters |

Headquarters drops a staff from the frame's lower-left corner — and moves the symbol's anchor
point to the foot of that staff. Task force adds a bracket above the frame. Feint/dummy adds the
dashed chevron described in §4.

### Amplifier / descriptor (positions 9–10)

One field, four mutually exclusive families.

| Code | Echelon | | Code | Mobility |
|---|---|---|---|---|
| `00` | None | | `31` | Wheeled, limited cross-country |
| `11` | Team / Crew | | `32` | Wheeled, cross-country |
| `12` | Squad | | `33` | Tracked |
| `13` | Section | | `34` | Wheeled and tracked combination |
| `14` | Platoon / Detachment | | `35` | Towed |
| `15` | Company / Battery / Troop | | `36` | Rail |
| `16` | Battalion / Squadron | | `37` | Pack animals |
| `17` | Regiment / Group | | `41` | Over-snow (prime mover) |
| `18` | Brigade | | `42` | Sled |
| `21` | Division | | `51` | Barge |
| `22` | Corps / MEF | | `52` | Amphibious |
| `23` | Army | | | |
| `24` | Army Group / Front | | **Code** | **Towed array** |
| `25` | Region / Theater | | `61` | Short towed array |
| `26` | Command | | `62` | Long towed array |
| | | | **Code** | **Leadership** |
| | | | `71` | Leader — individual |
| | | | `72` | Deputy — individual |

### Sector modifiers (positions 17–18 + 21, and 19–20 + 22)

Three-digit codes, defined **per symbol set** and per sector, that qualify the entity — sector 1
is drawn above the icon, sector 2 below it. `000` in either sector means "no modifier".
Examples from the Land Unit set (`10`): sector 2 `100` *Airborne*, `113` *Mountain*,
`059` *Air Assault*, `060` *Amphibious*. There are 2 835 modifier entries in the bundled
catalogue — 2 058 for sector 1 and 777 for sector 2 — and the plugin's two dropdowns list
exactly the ones legal for the current set. The same code means different things in the two
sectors: in set `10`, `100` is *Airborne* in sector 2 but *Unmanned Aerial Vehicle* in sector 1.
Withdrawn modifier codes are kept in the lists as `{Disused}`.

### Frame shape override (position 23)

| Code | Meaning |
|---|---|
| `0` | From symbol set (default) |
| `1` | Space |
| `2` | Air |
| `3` | Land unit |
| `4` | Land equipment / sea surface |
| `5` | Land installation |
| `6` | Dismounted individual |
| `7` | Sea subsurface |
| `8` | Activity / event |
| `9` | Cyberspace |
| `A` | Unframed |

This is the only position that is not a digit: `A` draws the icon with no frame at all. Leave it
at `0` unless you deliberately want, say, a land entity drawn in an air frame.

### Reserved (positions 24–30)

Seven zeros. The plugin always writes zeros and ignores whatever you paste there.

---

## 3. Four codes, decoded

### `140310001512110000000000000000` — friendly infantry company

| Digits | Field | Value |
|---|---|---|
| `14` | Version | APP-6E |
| `0` | Context | Reality |
| `3` | Affiliation | Friend → solid rectangle frame, cyan fill |
| `10` | Symbol set | Land Unit |
| `0` | Status | Present |
| `0` | HQ/TF/D | — |
| `15` | Amplifier | Echelon: Company / Battery / Troop → `I` above the frame |
| `121100` | Entity | Movement and Maneuver / **Infantry** → crossed rifles |
| `00 00 0 0` | Modifiers | none |
| `0` | Frame shape | from the symbol set |
| `0000000` | Reserved | — |

### `140610001612050000000000000000` — hostile armoured / mechanised battalion

| Digits | Field | Value |
|---|---|---|
| `14` | Version | APP-6E |
| `0` | Context | Reality |
| `6` | Affiliation | Hostile → solid diamond frame, red fill |
| `10` | Symbol set | Land Unit |
| `0` `0` | Status, HQ/TF/D | Present, — |
| `16` | Amplifier | Echelon: Battalion / Squadron → `II` |
| `120500` | Entity | Movement and Maneuver / **Armor / Mechanized** → the track oval |
| rest | — | no modifiers, default frame |

Change digit 4 from `6` to `3` and you have the friendly version of the same unit — which is
exactly what the **Change affiliation** chips on the Canvas tab do.

### `140501000011030000000000000000` — suspect unmanned aerial vehicle

| Digits | Field | Value |
|---|---|---|
| `14` | Version | APP-6E |
| `0` | Context | Reality |
| `5` | Affiliation | **Suspect** → hostile diamond shape, **dashed**, amber fill |
| `01` | Symbol set | Air |
| `0` `0` | Status, HQ/TF/D | Present, — |
| `00` | Amplifier | none — aircraft do not take echelons |
| `110300` | Entity | Military / **Unmanned Aircraft (UAV/UAS/RPV)** |
| rest | — | no modifiers, default frame |

Set digit 3 to `1` (Exercise) and this becomes a **joker**: an exercise opponent, drawn with a
friendly frame shape in suspect colours.

### `140310001512110000000100000000` — friendly airborne infantry company

The same infantry company as the first example, plus one sector 2 modifier. Watch where the
modifier's digits land:

| Digits | Field | Value |
|---|---|---|
| `14` `0` `3` `10` `0` `0` `15` `121100` | as above | friendly infantry company |
| `00` (17–18) | Sector 1 modifier, low digits | — |
| `00` (19–20) | Sector 2 modifier, low digits | `00` |
| `0` (21) | Sector 1 modifier, high digit | — |
| `1` (22) | Sector 2 modifier, high digit | `1` |
| | **Sector 2 modifier** | `1` + `00` = **`100` Airborne** → the airborne wing glyph under the icon |
| `0` `0000000` | Frame shape, reserved | defaults |

---

## 4. What makes a frame dashed

Three independent rules, in the order they matter:

1. **Affiliation** (digit 4) — Pending (`0`), Assumed Friend (`2`) and Suspect (`5`) are always
   drawn with a dashed frame, a short `4,4` dash. This rule wins over rule 2.
2. **Status = Planned / Anticipated** (digit 7 = `1`) — dashed frame, a longer `8,12` dash. If
   the affiliation is already one of the three above, you see the affiliation's `4,4` dash
   instead; the symbol does not get two dash patterns.
3. **Feint / Dummy** (digit 8 = `1`, `3`, `5` or `7`) — this one does **not** dash the frame. It
   adds a dashed inverted V over the top of the frame, an `8,8` dash. A planned feint therefore
   shows both: a `8,12` dashed frame and an `8,8` dashed chevron above it.

How the dash is painted depends on the fill:

- **Filled symbols** (the default) keep a solid black frame outline and get a dashed light line
  drawn on top of it — the frame reads as "broken" without losing its colour.
- **Unfilled or monochrome symbols** have the frame stroke itself dashed.

A handful of entities carry a dashed frame regardless of affiliation, because the standard
requires it. In the bundled catalogue there are exactly three, all of them uncertain track
types: *Fused Track* in Sea Surface (`30`, entity `160000`), and *Echo Tracker Classifier (ETC)
/ Possible Contact (POSCON)* (`140000`) and *Fused Track* (`150000`) in Sea Subsurface (`35`).

Some symbols have no frame at all: every point entity in the Control Measure set (`25`) draws
its glyph unframed. `140325000013030000000000000000` (*Checkpoint*) is a bare gate glyph, so
affiliation is carried by the colour alone — and only hostile changes it. Friend, neutral,
unknown and pending control measures are all drawn in black; hostile ones in red.

---

## 5. Verified codes to start from

Paste any of these into the Batch tab, into the SIDC strip on the Build tab, or after a `|` in
an ORBAT outline. All are APP-6E (`14…`), reality, friend unless noted, and all render a real
icon. (The Build tab's *Start from a preset* shelf holds 231 more, already captioned.)

| SIDC | Symbol |
|---|---|
| `140310001412110000000000000000` | Infantry platoon |
| `140310001512110000000000000000` | Infantry company |
| `140610001612050000000000000000` | Armoured / mechanised battalion (hostile) |
| `140410001516020000000000000000` | Supply company, all classes (neutral) |
| `140310021611000000000000000000` | Command and control, headquarters |
| `140315003312020000000000000000` | Tank, tracked |
| `140315003511090200000000000000` | Medium howitzer, towed |
| `140301000011010400000000000000` | Fighter, fixed wing |
| `140601000011030000000000000000` | Unmanned aerial vehicle (hostile) |
| `140305000011070000000000000000` | Satellite |
| `140330000012010000000000000000` | Aircraft carrier |
| `140335000011010000000000000000` | Submarine |
| `140320000012070200000000000000` | Medical treatment facility (hospital) |
| `140327000011021500000000000000` | Dismounted infantry individual |
| `140640000011030000000000000000` | IED event (hostile) |
| `140311000011030000000000000000` | Civilian individual (purple civilian ramp) |
| `140325000013030000000000000000` | Checkpoint (control measure, unframed) |

---

## 6. What the plugin does with a code you paste

- Everything but digits and the letter `A` is stripped, so spaces, dashes and line breaks in a
  pasted code are harmless — and a lower-case `a` in position 23 is accepted and upper-cased
  (`cleanSidcInput()` in `src/core/sidc.ts`).
- Short codes are right-padded with zeros; long ones are truncated at 30 digits. A 20-digit
  D-edition code therefore becomes a valid 30-digit code with no modifiers and no frame
  override.
- Fewer than ten digits is rejected rather than padded: the Build tab's code strip snaps back
  to the previous code, and the Batch tab skips the line. That is a guard against a half-typed
  code silently becoming a valid symbol.
- Out-of-range digits are reported as errors in a red banner on the Build tab (context, status,
  affiliation, HQ/TF/D and a malformed entity); unknown-but-plausible values — a version the
  plugin does not know, an undefined amplifier, a symbol set missing from the catalogue — are
  treated as warnings and still render.
- The version digits are **not** rewritten: paste a `13…` MIL-STD-2525E code and it stays `13`.
  Use the *Standard* setting to choose which edition's glyphs are drawn.
