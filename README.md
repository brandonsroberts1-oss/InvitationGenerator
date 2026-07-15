# Laser Wedding Invitation Generator

A small web app that designs **laser-cut wedding invitations** and exports
them as **laser-ready SVG**. Two templates are built in:

- **Arch die-cut** *(default)* — a single 5×7″ card with a full-arch top,
  fine double border, a swappable engraved graphic in the dome, stacked
  script names and an oversized date row. Based on 2026 stationery trends
  (sculptural die-cut shapes, hand-illustrated motifs, mixed script/serif
  typography, oversized dates).
- **Gatefold lace doors** — a 5×7″ engraved centre panel flanked by two
  generative lace doors with a decorative heart, joined with binding rings.

Type into the form and the invitation updates live. When you're happy,
download the SVG and drop it straight into LightBurn, Glowforge, xTool
Creative Space, Inkscape, etc.

## Features

- **Live editable fields** – tagline, names, date block, venue, address,
  RSVP and footer lines. Text that gets too long shrinks automatically to fit.
- **Swappable graphics** – choose the engraved motif: old romantic tree
  (generative — every shuffle grows a new one), laurel wreath with the
  couple's initials, tiered wedding cake, mountain range, or wedding rings.
- **Generative lace doors** (gatefold) – the crackle lattice is generated from
  a seeded Delaunay triangulation; hit *Shuffle* until you like it. Every
  cutout keeps a minimum 2.2 mm web so the piece stays strong.
- **Heart with cut flower** on the right door, plus binding-ring holes that
  line up between the doors and the panel.
- **Laser-ready SVG export** *(recommended)*:
  - All text is traced to vector outlines with the real font files
    (opentype.js), so it renders identically everywhere — no fonts needed.
  - **Red hairline (`#FF0000`, 0.1 mm) = cut**, **black = engrave**
    (fills for text/ornaments, 0.35 mm black strokes = line engrave).
  - True millimetre units (`1 SVG unit = 1 mm`); the sheet imports at exactly
    the right physical size (131 × 182 mm for the arch card, 261 × 182 mm for
    the gatefold, 131 × 182 mm panel only).
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
3. Cut from ~3 mm plywood or basswood — 1/8″ Baltic birch works great — or
   heavy cardstock.
4. Gatefold only: join the doors to the panel through the 4 mm binding holes
   with small book rings, brads, or ribbon — the doors fold over the panel
   like gates. (Untick *Lace fold-out doors* to export just the engraved
   panel.)

## Project layout

```
index.html        page & form
css/style.css     UI styling + preview colours
js/lattice.js     seeded RNG, Delaunay triangulation, lace generation
js/template.js    invitation geometry & text layout (all sizes in mm)
js/motifs.js      swappable engraved graphics (tree, wreath, cake, ...)
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
