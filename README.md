# Laser Wedding Invitation Generator

A small web app that designs a laser-cut **gatefold wedding invitation** — a
5×7″ engraved centre panel flanked by two lace-pattern doors with a decorative
heart — and exports it as a **laser-ready SVG**.

Type into the form and the invitation updates live. When you're happy, download
the SVG and drop it straight into LightBurn, Glowforge, xTool Creative Space,
Inkscape, etc.

## Features

- **Live editable fields** – tagline, title, names, date block, venue, address,
  RSVP and footer lines. Text that gets too long shrinks automatically to fit.
- **Generative lace doors** – the crackle lattice is generated from a seeded
  Delaunay triangulation; hit *Shuffle lace pattern* until you like it. Every
  cutout keeps a minimum 2.2 mm web so the piece stays strong.
- **Heart with cut flower** on the right door, plus binding-ring holes that
  line up between the doors and the panel.
- **Laser-ready SVG export** *(recommended)*:
  - All text is traced to vector outlines with the real font files
    (opentype.js), so it renders identically everywhere — no fonts needed.
  - **Red hairline (`#FF0000`, 0.1 mm) = cut**, **black = engrave**
    (fills for text/ornaments, 0.35 mm black strokes = line engrave).
  - True millimetre units (`1 SVG unit = 1 mm`); the sheet imports at exactly
    the right physical size (261 × 182 mm with doors, 131 × 182 mm panel only).
- **Editable-text SVG export** – keeps `<text>` elements for further editing in
  Figma/Illustrator/Inkscape (requires Great Vibes + Playfair Display
  installed to display correctly).

## Running it

It's a static site, but it must be served over HTTP (the exporter fetches the
font files, which browsers block from `file://`). Any static server works:

```bash
cd InvitationGenerator
python3 -m http.server 8000
# then open http://localhost:8000
```

or `npx serve`, or VS Code's *Live Server* — no build step, no dependencies to
install.

## Laser workflow

1. **Download laser-ready SVG** in the app.
2. Import into your laser software. By colour:
   - **Red** paths → *cut* (through-cut).
   - **Black** fills/strokes → *engrave*.
3. Cut the three pieces (left door, panel, right door) from ~3 mm plywood or
   basswood. 1/8″ Baltic birch works great.
4. Join the doors to the panel through the 4 mm binding holes with small book
   rings, brads, or ribbon — the doors fold over the panel like gates.

Untick *Lace fold-out doors* to export just the 5×7″ engraved panel (handy for
paper/cardstock versions too).

## Project layout

```
index.html        page & form
css/style.css     UI styling + preview colours
js/lattice.js     seeded RNG, Delaunay triangulation, lace generation
js/template.js    invitation geometry & text layout (all sizes in mm)
js/textpaths.js   text → outline tracing for export (opentype.js)
js/app.js         state, live preview, export & download
fonts/            Great Vibes + Playfair Display (SIL Open Font License)
vendor/           opentype.js (MIT)
```

## Customising the design

Everything geometric lives in `js/template.js` in millimetres: panel size
(`GEO`), heart position/size (`HEART`), and every text line's position/size in
`panelGroup()`. Lattice density and strut width are the defaults of
`generateLattice()` in `js/lattice.js`.

## Licenses

- Fonts: [Great Vibes](https://fonts.google.com/specimen/Great+Vibes) and
  [Playfair Display](https://fonts.google.com/specimen/Playfair+Display),
  both under the SIL Open Font License 1.1.
- [opentype.js](https://github.com/opentypejs/opentype.js) — MIT.
