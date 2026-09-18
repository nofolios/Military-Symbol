# Third-party software

The Military Symbols bundles the three packages below into the built plugin
(`dist/ui.html` and `dist/code.js`). All three are MIT licensed. The full licence text appears
once at the end of this file; each package's own copyright line is given with the package.

## Bundled in the plugin

### milsymbol

- **Version:** 3.0.4 (declared as `^3.0.4`)
- **Licence:** MIT
- **Copyright:** `Copyright (c) 2017 Måns Beckman - www.spatialillusions.com`
- **Home:** https://github.com/spatialillusions/milsymbol
- **Used for:** drawing every symbol. milsymbol turns a SIDC plus style options into SVG;
  the plugin bundles it into the UI and never calls it from the Figma sandbox.

### milstandard-e

- **Version:** 0.2.14
- **Licence:** MIT
- **Copyright:** `Copyright (c) 2017 Måns Beckman - www.spatialillusions.com`
- **Home:** https://github.com/spatialillusions/milstandard-e
- **Used for:** the entity and modifier catalogue. `build/build-catalog.mjs` reads the package's
  TSV tables at build time and writes `src/data/catalog.json`, which is bundled into the plugin.
  The package itself is a development dependency, but the data derived from it **is
  redistributed** in the built plugin, so its licence and copyright notice apply.

### Preact

- **Version:** 10.29.8 (declared as `^10.24.3`)
- **Licence:** MIT
- **Copyright:** `Copyright (c) 2015-present Jason Miller`
- **Home:** https://preactjs.com
- **Used for:** the plugin's user interface.

## Build tools (not redistributed)

These are used to build the plugin and are not part of anything shipped to a user:

| Package | Version | Licence |
|---|---|---|
| esbuild | 0.25.12 | MIT |
| TypeScript | 5.9.3 | Apache-2.0 |
| @figma/plugin-typings | 1.138.0 | MIT |

## Standards

APP-6E (STANAG 2019 Edition E) and MIL-STD-2525E are published by NATO and by the US Department
of Defense respectively. This plugin is an independent implementation of the symbology they
describe; it is not endorsed by, affiliated with or derived from any official distribution of
those documents.

---

## The MIT Licence

The text below is the licence under which milsymbol, milstandard-e and Preact are distributed.
It applies to each of them separately, with that package's own copyright line as given above.

```
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
