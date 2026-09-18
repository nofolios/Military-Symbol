# Using the Military Symbols

One short section per task. The plugin has six tabs — **Build**, **Browse**, **Batch**,
**ORBAT**, **Canvas**, **Settings** — and a footer button whose action always belongs to the
tab you are looking at.

If a code in these instructions means nothing to you, [docs/SIDC.md](SIDC.md) explains what
each digit of a SIDC does.

---

## Build a symbol

1. Open the **Build** tab. The preview at the top always shows exactly what will be inserted.
2. **Identity** — choose the *Symbol set* (land unit, air, sea surface, …), the *Affiliation*
   (friend, hostile, neutral, unknown and the three dashed-frame identities), the *Context*
   (reality, exercise, simulation) and the *Status* (present, planned, damaged, destroyed …).
3. **Entity** — search for what the symbol depicts and click a result. Changing the symbol set
   clears the entity, because entity codes only mean anything inside their set.
4. **Modifiers** — the two optional sector modifiers qualify the entity (for example *Airborne*
   or *Mountain* on a land unit). The lists are filtered to the current symbol set.
5. **Amplifiers** — *Echelon / mobility* sets the size bracket above the frame or the mobility
   bar below it; *HQ / task force / dummy* adds the HQ staff, the task-force bracket or the
   dashed feint chevron; *Frame shape* forces a frame the symbol set would not normally use —
   including *Unframed*, which draws the icon on its own.
6. Press **Insert symbol**.

Four notes on the preview:

- A **no symbol** pill means APP-6E defines no point symbol for this code at all. What you see
  is the renderer's question-mark glyph, and that is what would be inserted. Pick a different
  entity, or draw the graphic by hand.
- A **frame only** pill means the code resolves to a bare frame — APP-6E defines no icon for it,
  or the renderer does not draw one. Usually it means the entity is still unset or you picked a
  container node rather than a leaf.
- A **line / area / axis / corridor graphic** pill means the entity is a control measure that
  the standard draws as a line or a shape on the map rather than as a point symbol. See
  *Control measures* below.
- A red banner lists structural errors (an out-of-range digit). Warnings that do not block
  rendering are not shown there.

**The code strip.** Under the preview sits the 30-character SIDC with three buttons:

| Control | What it does |
|---|---|
| the code itself | click to edit it in place; press Enter to commit, Escape to cancel |
| **★** / **☆** | adds or removes the code from your favourites (the Batch tab can insert them all) |
| **SIDC** | copies the full code to the clipboard |
| **SVG** | copies the symbol itself to the clipboard as SVG, amplifier text included |

When you type a code in, everything except digits and the letter `A` — the unframed frame-shape
override in position 23 — is ignored, short input is right-padded with zeros and long input is
truncated to 30 characters. Fewer than ten characters is treated as a slip and the field snaps
back to the previous code, so a 20-digit D-edition code is fine but `1403` is not.

---

## Start from a preset

The fastest way in if you do not know the codes. On the **Build** tab, open **Start from a
preset**: 231 ready-made symbols, grouped into 12 categories (land manoeuvre, combat support,
sustainment, air, space, maritime, equipment, installations, activities, individuals, control
measures, cyber & SIGINT).

- Type in the search box to filter by name or keyword — `ifv`, `hospital`, `uav`, `trp`.
- Or press a category chip; **All** clears it. 60 presets are shown at a time, with a
  *Show N more of M* button under the sheet.
- Clicking a preset loads it into the builder. It replaces **the whole code**, affiliation,
  echelon and status included, so pick the preset first and adjust afterwards. Your text
  amplifiers and your style settings are left alone.

Every preset is checked in CI to be a structurally valid APP-6E code that draws real icon
geometry, so a preset never lands you on an empty frame.

---

## Find an entity fast

- Type into the search box under *Entity*. All tokens must match; matches on the leaf name rank
  above matches on the parent path, and earlier matches rank above later ones. So `med tr`
  finds *Medical Treatment Facility*.
- Press **All sets** to search the whole catalogue instead of the current symbol set. Picking a
  result from another set switches the symbol set for you and resets the modifiers.
- Entity codes are searchable too — paste `121100` to jump straight to *Infantry*.
- A result whose entity is a line, area, axis or corridor graphic says so after the path.
- An entity with remarks in the standard shows them in a banner under the picker.

**Withdrawn codes.** The catalogue keeps the codes the standard has withdrawn — 47 entities and
202 sector modifiers, all named `{Disused}` — so that an old SIDC still decodes to something
rather than to nothing. They are excluded from entity search and from the sector-modifier
dropdowns, so you cannot pick one by accident. Paste a SIDC that uses one and the dropdown shows
it under *From the pasted code*, marked *withdrawn*, so you can see what you have and change it.

---

## Control measures: not everything is a point symbol

Symbol set 25 (*Control Measure*) is the one set where a catalogue entry often has no symbol at
all. Of its 628 entries, about 300 — 95 lines, 195 areas, 5 axes and 7 corridors — are drawn on
a map as a **graphic**: a boundary, a phase line, a fire support area, an axis of advance. The
standard defines their geometry, not an icon.

This plugin inserts point symbols only. When you select one of those entities the preview
labels it (*line graphic*, *area graphic*, *axis graphic*, *corridor graphic*) and what you
insert will be the plain frame or glyph, not the line or the shape. Draw those with Figma's own
vector tools.

The remaining entries in set 25 — checkpoints, observation posts, target reference points,
casualty collection points and the rest — are genuine point symbols and work exactly like any
other entity.

---

## Set echelon and mobility

Both live in the same SIDC field, so a symbol is either echeloned or mobile, never both.
Use *Amplifiers → Echelon / mobility* on the Build tab:

| Group | Examples | Drawn as |
|---|---|---|
| Echelon | Team/Crew, Squad, Section, Platoon, Company, Battalion, Brigade, Division, Corps, Army | dots, bars or Xs above the frame |
| Mobility | Wheeled, Wheeled cross-country, Tracked, Towed, Rail, Over-snow, Sled, Barge, Amphibious, Pack animals | a wheel/track/ski bar under the frame |
| Towed array | Short towed array, Long towed array | a line with diamonds, for sonar platforms |
| Leadership | Leader, Deputy | a chevron over a dismounted individual |

Echelon is for units (symbol set 10 and friends); mobility is for equipment (symbol set 15).
Applying a mobility code to a unit is legal in the code but rarely what you want.

To produce the whole ladder at once — the same symbol at every echelon — see *Insert a batch*.

---

## Add text amplifiers

1. On the **Build** tab, open the **Text amplifier fields** accordion. The badge shows how many
   fields are filled.
2. Fill the ones you need — 27 fields, each labelled with its designator from the standard:
   *T* unique designation, *M* higher formation, *V* type, *C* quantity, *W* date-time group,
   *F* reinforced/reduced, *J* evaluation rating, *Q* direction of movement, and twenty more.
3. *Q — Direction of movement* is a number in degrees (0–360) and draws the movement leader line.
4. Insert as usual.

Two fields milsymbol nominally accepts — *R2 sigint* and *AG auxiliary equipment indicator* —
are deliberately not offered, because milsymbol 3.0.4 declares them but never draws them.

What you get in Figma: the symbol geometry is imported as vectors, and every amplifier becomes a
**real Figma text layer** placed over it, so you can retype or restyle it afterwards. The plugin
uses the first of Arial, Helvetica, Roboto or Inter that your Figma account has available.

If the file will be opened by people who may not have that font, turn on
**Settings → Text amplifiers → Outline amplifier text**: the text layers are flattened to vector
outlines on insertion. You lose editability and gain portability.

To hide amplifiers entirely without clearing the fields, turn off
**Settings → Text amplifiers → Show text amplifier fields**.

> Text amplifiers belong to the one symbol you are building. Symbols inserted from the
> **Browse**, **Batch** and **ORBAT** tabs are always inserted without amplifier text.

---

## Insert a batch as a grid

**From a symbol set sheet (Browse):**

1. Open **Browse** and choose a *Symbol set*. The *Affiliation* dropdown beside it sets the
   affiliation for the whole sheet — and, because affiliation belongs to the symbol you are
   building. Changing it redraws the sheet in place and clears any selection you had made,
   because a selected thumbnail is remembered by its full code, affiliation included.
2. Type in the filter box to narrow the set.
3. Two toggles control what the sheet shows:
   - **Hide codes with no icon** (on by default) drops two kinds of entry: hierarchy
     placeholders that draw a bare frame, and codes with no point symbol at all, which would
     otherwise show the renderer's question mark. The counter tells you how many were hidden.
   - **Match builder** (off by default) applies the builder's echelon, status and HQ flag to
     every thumbnail. With it off you get the plain entity at that affiliation, which is
     usually what you want from a reference sheet.
4. Click thumbnails to select them, or press **Select page** to take everything currently
   shown; **Clear** drops the selection. *Show more* loads the next 120 entries.
5. Alt-click a thumbnail instead to open that symbol in the builder.
6. Press **Insert N selected**.

**From a list or a generator (Batch):**

1. Open **Batch** and pick a *Source*:
   - **Paste SIDC list** — one SIDC per line. Anything after a comma, tab or pipe becomes the
     layer name; lines starting with `#` are ignored; non-digits are stripped and lines with
     fewer than ten digits are skipped.
     ```
     140310001512110000000000000000, Infantry company
     140610001612050000000000000000 | Hostile armour battalion
     140315003312020000000000000000  Tank
     ```
   - **Affiliation series / Echelon ladder / Status series** — expands the symbol currently in
     the Build tab along that one axis.
   - **Whole symbol set sheet** — every entity in a set.
   - **Favourites** / **Recently inserted** — the codes you starred, or the last 40 you inserted.
2. The gallery previews the first 200; inserting always uses the whole list.
3. Press **Insert N symbols**.

> One insert carries at most **500** symbols. Ask for more and the plugin inserts the first 500
> and says so, rather than locking the editor up while it builds the rest.

**Controlling the layout** (Settings → Insertion), which applies to every insert:

| Setting | Effect |
|---|---|
| Layout | *Grid at the viewport centre*, *Single row*, *Stacked at the viewport centre*, or *Inside the selected frame* |
| Columns | grid width, 1–40 |
| Gap | spacing in px between cells |
| Height | exact height in px for every symbol; `0` keeps each symbol's natural size |
| Insert as components | each symbol becomes a Figma component |
| Add a caption under each symbol | a 10 px label under each cell |
| Wrap everything in one frame | collects the insert into a named white frame |

**Inside the selected frame** is the one layout that does not use the viewport. It drops the
insert into whatever you have selected: the selected node if it can hold children, otherwise that
node's parent, otherwise the page. The grid is centred in the container, and a container with
auto-layout will of course place the symbols itself. It composes with *Wrap everything in one
frame* — the wrapper is then what lands inside the selection.

Two more things worth knowing: symbols are centred inside equally sized cells on their octagon
anchor — the point the standard puts on the map — so mixed frame shapes and hanging HQ staffs
still line up; and *Insert as components* is ignored while *Wrap everything in one frame* is on
— the wrapper wins.

For a tidy reference sheet, set a fixed **Height**, turn on **Square bounding box** (Settings →
Rendering) so air, land and sea frames occupy the same box, and add captions.

---

## Draw an order of battle

The **ORBAT** tab turns an indented outline into a laid-out chart: one symbol per unit, a
caption under each, and connectors from every parent to its children.

1. Open **ORBAT**. It starts on a worked example — an armoured brigade — which the **Example**
   button restores at any time. **Syntax** opens a short reminder in the panel.
2. Edit the outline. One unit per line; indent to nest subordinates. Indentation is compared
   against the line's ancestors rather than against a fixed step, so two spaces, four spaces or
   tabs all work (a tab counts as two spaces). Blank lines and lines starting with `#` are
   ignored.
3. After the unit's name, add `|`-separated directives. Order does not matter:

   | Directive | Examples | Effect |
   |---|---|---|
   | echelon | `team`, `squad`, `platoon`/`det`, `company`/`coy`/`battery`/`troop`, `battalion`/`bn`/`squadron`/`sqn`, `regiment`/`regt`/`group`, `brigade`/`bde`, `division`/`div`, `corps`, `army`, `front`, `theatre`, `command` — or the two-digit code, `16` | SIDC positions 9–10 |
   | affiliation | `friend`/`friendly`/`blue`, `hostile`/`enemy`/`red`, `neutral`/`green`, `unknown`/`unk`, `assumed`, `suspect`, `pending` — or the single digit, `6` | SIDC position 4 |
   | entity | a six-digit entity code, `121100` | SIDC positions 11–16 |
   | `hq` | `hq`, `headquarters` | adds the headquarters staff |
   | `tf` | `tf`, `taskforce` | adds the task-force bracket (`hq` and `tf` together give a task-force HQ) |
   | full SIDC | `140310001812110000000000000000` | replaces the whole code for that line (20 characters or more) |

   ```
   1st Armoured Brigade | bde | hq
     1-7 Infantry | bn | 121100
       A Company | company
       B Company | company
     2-5 Armour | bn | 120500
       A Troop | troop
     OPFOR screen | bn | hostile | 120500
   ```

4. **What is inherited.** Every line starts from its parent's finished code — symbol set,
   entity, affiliation, echelon and all — and then applies its own directives, so a hostile
   parent makes the whole subtree hostile and only the echelon has to change per level. The
   root line inherits from the symbol currently on the **Build** tab, which is how you choose
   the symbol set and the default entity. The one thing that never inherits is the `hq` / `tf`
   flag: without it every subordinate of a headquarters would be drawn as one too.
5. Anything the parser does not recognise is listed under the outline as
   `Line N: Directive "…" not understood`, and the unit count tells you how many symbols the
   chart will contain. The preview is live and scaled to fit the panel.
6. **Chart layout** (accordion at the bottom) controls the drawing, not the symbology:

   | Setting | Effect |
   |---|---|
   | Chart name | the name of the Figma frame the chart lands in |
   | Cell width / Cell height | the box each unit gets, 40–400 and 30–400 px |
   | Gap across / Gap down | space between sibling subtrees and between generations |
   | Label strip | height reserved for the caption under each symbol, 0–60 px |
   | Label size | caption font size, 6–40 px |
   | Symbol size | frame height in px; every symbol in the chart uses the same one, so a headquarters staff grows the symbol rather than shrinking its frame |

7. Press **Draw N units**. You get one frame, named after *Chart name*, containing a
   **Connectors** vector layer behind the symbols, then a symbol and a caption per unit. Each
   symbol carries its own SIDC, so the Canvas tab can restyle or re-affiliate it afterwards.

Two things to know: the insertion settings (layout, height, captions, wrapper frame) do not
apply to an ORBAT — the chart brings its own layout — and the outline is not saved between
sessions, so keep a copy of anything long outside the plugin.

---

## Make a component set with affiliation variants

1. Build the symbol you want on the **Build** tab.
2. Press **Variants** (next to *Insert symbol*).

You get one component set, named after the entity, containing seven components — Pending,
Unknown, Assumed Friend, Friend, Neutral, Suspect/Joker, Hostile/Faker — exposed as a variant
property called **Affiliation**. The set is laid out horizontally with auto-layout, so dropping
an instance into a design and flipping *Affiliation* in the right-hand panel swaps the frame.

Everything else (entity, echelon, status, amplifier text, style) is identical across the
variants, so build the symbol completely before pressing the button.

---

## Re-edit a symbol already on the canvas

Every symbol the plugin inserts carries its full specification — SIDC, amplifier text and style
— as plugin data on the layer.

1. Select one or more inserted symbols on the canvas.
2. Open the **Canvas** tab. It reports how many of the selected nodes are plugin symbols and
   ignores the rest. The tab header carries the count too, so you can see it from anywhere.
3. Click a symbol in the *Selected symbols* list to load its SIDC **and** its amplifier text back
   into the **Build** tab. Change what you like there and insert a new one.
4. To re-render the selection in place instead, press
   **Re-render N symbols with the current style** under *Restyle*. Each node is replaced where it
   stands — same position, same size, same place in the layer tree and in any parent auto-layout.
5. **Zoom to selection** in the footer scrolls the viewport onto what you have selected.

An inserted symbol also carries an **Edit APP-6E symbol** relaunch button in Figma's right-hand
panel. It reopens the plugin on the **Canvas** tab with that symbol selected.

> *Restyle* applies the style currently set in **Settings**, not the style the symbol was
> created with. That is what makes it useful for bringing an old insert into line with a new
> look — and what makes it destructive if you only meant to nudge one symbol.

---

## Swap affiliation in place

1. Select the symbols on the canvas.
2. Open the **Canvas** tab and press one of the seven affiliation chips.

Each symbol is re-rendered at the height it already has and put back exactly where it was, with
its layer name updated. The entity, echelon, status and amplifier text are preserved. This is
the fastest way to turn a friendly laydown into the opposing force's version of the same graphic.

As with *Restyle*, the current Settings style is applied.

---

## Style recipes

These are settings combinations worth remembering, not saved presets — the plugin's *presets*
are ready-made **symbols**, on the Build tab. Everything here lives in **Settings**, and applies
to every symbol you insert from then on.

### Briefing slides (light background, projected)

| Setting | Value |
|---|---|
| Colour mode | **Light** (the standard fills: cyan friend, red hostile, green neutral, yellow unknown) |
| Fill frame | on |
| Stroke width | 3–4 |
| Height | 96 px or larger — projectors lose thin strokes |
| Amplifier text size | 40, or larger if you use few amplifiers |
| Outline amplifier text | on, if the deck will be opened on machines without your fonts |
| Square bounding box | on, if symbols sit in a row or table |

### Dark COP mockups (dark background)

| Setting | Value |
|---|---|
| Colour mode | **Frame colour (high contrast)** (pure cyan / red / green / yellow outlines) or **Monochrome** with a light colour |
| Fill frame | off — unfilled symbols read far better on dark |
| Outline width | 2–3 with a dark **Outline colour** (`#000000`), for a halo that keeps the symbol legible over imagery |
| Stroke width | 4 |
| Civilian colour ramp | off, unless you need the purple civilian frames |

Two notes for unfilled symbols:

- **Suspect** symbols are fine here. milsymbol 3.0.4 ships the Suspect frame colour as
  `rbg(255, 188, 1)` — a typo that would make the frame fall back to black — and the plugin
  repairs it when it loads, so an unfilled suspect symbol keeps its amber line.
- **Monochrome** mode replaces every colour, so affiliation is then carried by the frame shape
  and the dash pattern alone — quatrefoil/rectangle/square/diamond, dashed or solid.

### Print and monochrome handouts

Colour mode **Black** (or **Monochrome** with `#000000`), *Fill frame* off, stroke width 4,
outline width 0. The result is a clean line drawing that survives photocopying.

---

## Things worth knowing

- **Preferences persist.** Style, insertion options, favourites, recents and the last SIDC are
  stored per user by Figma and restored the next time you open the plugin. **Reset all settings**
  (bottom of Settings) restores the defaults but keeps favourites and recents. The ORBAT outline
  and the Browse selection are *not* stored.
- **Size is baked in, not scaled.** Setting *Height* re-renders the symbol at that size rather
  than scaling a node, so stroke weights and amplifier text stay correct. Resizing an inserted
  symbol by dragging its handles will distort the stroke weights — re-insert or restyle instead.
- **Layers do not clip.** Amplifier text and movement arrows routinely overhang the frame, so
  inserted frames have clipping turned off and no background fill.
- **Figma Design only.** Components, component sets and variants do not exist in FigJam or
  Slides, so the manifest declares `"editorType": ["figma"]` and the plugin is not offered in
  the other editors.
- **Nothing leaves your machine.** The plugin declares no network access at all.
