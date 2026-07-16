/*
 * Builds the invitation SVG.
 *
 * The design is a laser-cut gatefold: a centre panel (5 x 7 in) flanked by
 * two lace doors that tie on with binding rings through small holes. All
 * coordinates are world coordinates in millimetres - no transform attributes
 * are used anywhere, which keeps the exported file trivial for laser
 * software to interpret.
 *
 * Layers (via data-layer):
 *   cut          - closed shapes the laser cuts through (red on export)
 *   engrave      - filled artwork/text the laser engraves (black on export)
 *   engrave-line - stroked outlines to line-engrave (black stroke on export)
 */

'use strict';

const NS = 'http://www.w3.org/2000/svg';

const GEO = (() => {
  const H = 178; // panel height (7 in)
  const panelW = 127; // panel width (5 in)
  const doorW = 62;
  const gap = 3; // space between pieces in the cut layout
  const panelX = doorW + gap;
  const rightDoorX = panelX + panelW + gap;
  return {
    H,
    panelW,
    doorW,
    gap,
    panelX,
    rightDoorX,
    totalW: rightDoorX + doorW,
    cx: panelX + panelW / 2,
    holeYs: [49, 129],
    holeR: 2,
    margin: 2, // blank margin around the whole sheet
  };
})();

const FONT_CSS = {
  script: { family: "'Great Vibes', cursive" },
  serif: { family: "'Playfair Display', serif" },
  serifSemi: { family: "'Playfair Display', serif", weight: '600' },
  serifItalic: { family: "'Playfair Display', serif", style: 'italic' },
};

function el(name, attrs = {}, children = []) {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) {
    if (v !== undefined && v !== null && v !== '') node.setAttribute(k, v);
  }
  for (const c of children) node.append(c);
  return node;
}

/* ------------------------------------------------------------------ */
/* Door outline                                                        */
/* ------------------------------------------------------------------ */

/** Left door outline; the outer edge has a soft bracket-shaped notch. */
function leftDoorSegs() {
  const w = GEO.doorW;
  const H = GEO.H;
  const r = 10; // outer corner radius
  const notch = 17; // notch depth
  const midY = H / 2;
  return [
    ['M', w, 0],
    ['L', r, 0],
    ['Q', 0, 0, 0, r],
    ['L', 0, midY - 40],
    ['C', 0, midY - 18, notch, midY - 10, notch, midY],
    ['C', notch, midY + 10, 0, midY + 18, 0, midY + 40],
    ['L', 0, H - r],
    ['Q', 0, H, r, H],
    ['L', w, H],
    ['Z'],
  ];
}

function rightDoorSegs() {
  return transformSegs(leftDoorSegs(), ([x, y]) => [GEO.totalW - x, y]);
}

/* ------------------------------------------------------------------ */
/* Heart with cut flower decoration (right door)                       */
/* ------------------------------------------------------------------ */

/** Canonical heart centred on the origin; s is roughly the half-width. */
function heartSegs(s) {
  return [
    ['M', 0, -0.32 * s],
    ['C', 0.14 * s, -0.62 * s, 0.62 * s, -0.56 * s, 0.62 * s, -0.12 * s],
    ['C', 0.62 * s, 0.18 * s, 0.26 * s, 0.36 * s, 0, 0.62 * s],
    ['C', -0.26 * s, 0.36 * s, -0.62 * s, 0.18 * s, -0.62 * s, -0.12 * s],
    ['C', -0.62 * s, -0.56 * s, -0.14 * s, -0.62 * s, 0, -0.32 * s],
    ['Z'],
  ];
}

// Sized/placed so the rotated heart clears both the hinge edge and the
// notched outer edge of the right door.
const HEART = {
  cx: GEO.rightDoorX + 22.5,
  cy: GEO.H / 2,
  size: 29,
  rot: (-18 * Math.PI) / 180,
};

/** Decor below is drawn for a size-36 heart; scale it to the actual size. */
const HEART_K = HEART.size / 36;

function heartXform([x, y]) {
  const c = Math.cos(HEART.rot);
  const s = Math.sin(HEART.rot);
  return [HEART.cx + x * c - y * s, HEART.cy + x * s + y * c];
}

/** Heart-local decor coords (drawn for s=36) -> world. */
function heartDecorXform([x, y]) {
  return heartXform([x * HEART_K, y * HEART_K]);
}

/** Teardrop/petal path segments: tip at origin, bulb pointing along +x. */
function petalSegs(len, wid) {
  return [
    ['M', 0, 0],
    ['C', 0.55 * len, -wid, len, -wid * 0.9, len, 0],
    ['C', len, wid * 0.9, 0.55 * len, wid, 0, 0],
    ['Z'],
  ];
}

function rotateAbout([px, py], angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return ([x, y]) => [px + x * c - y * s, py + x * s + y * c];
}

/** Cut decoration inside the heart, in heart-local coordinates. */
function heartDecorSegLists() {
  const lists = [];
  // Six-petal flower slightly above centre.
  const fc = [0, 0.5];
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3 - Math.PI / 2;
    const place = rotateAbout(fc, a);
    // Petal tip starts a little away from the flower centre.
    lists.push(
      transformSegs(petalSegs(7, 2.3), (p) => place([p[0] + 3.4, p[1]]))
    );
  }
  // Two leaves up in the lobes.
  lists.push(
    transformSegs(petalSegs(6.5, 2.1), rotateAbout([3.5, -8], (-52 * Math.PI) / 180))
  );
  lists.push(
    transformSegs(petalSegs(6.5, 2.1), rotateAbout([-3.5, -8], (-128 * Math.PI) / 180))
  );
  return lists;
}

/** Small round cut holes inside the heart, heart-local [x, y, r]. */
const HEART_DOTS = [
  [0, 0.5, 1.9],
  [11.5, -4.5, 1.5],
  [-11.5, -4.5, 1.5],
  [8.5, 6.5, 1.2],
  [-8.5, 6.5, 1.2],
  [0, 14.5, 1.3],
];

/* ------------------------------------------------------------------ */
/* Ornaments (engraved)                                                */
/* ------------------------------------------------------------------ */

function ornament(cx, y) {
  const nodes = [];
  nodes.push(el('rect', barAttrs(cx - 16.5, y, 12)));
  nodes.push(el('rect', barAttrs(cx + 4.5, y, 12)));
  nodes.push(
    el('path', {
      d: `M ${cx - 2.6} ${y} L ${cx} ${y - 1.9} L ${cx + 2.6} ${y} L ${cx} ${y + 1.9} Z`,
      class: 'ink',
      'data-layer': 'engrave',
    })
  );
  for (const dx of [-19.5, 19.5]) {
    nodes.push(
      el('circle', {
        cx: cx + dx,
        cy: y,
        r: 0.55,
        class: 'ink',
        'data-layer': 'engrave',
      })
    );
  }
  return nodes;
}

/** A thin engraved horizontal bar centred on y. */
function barAttrs(x, y, w, h = 0.5) {
  return {
    x,
    y: y - h / 2,
    width: w,
    height: h,
    class: 'ink',
    'data-layer': 'engrave',
  };
}

/* ------------------------------------------------------------------ */
/* Text                                                                */
/* ------------------------------------------------------------------ */

function textEl(str, x, y, { font = 'serif', size = 5, ls = 0, maxW, anchor = 'middle' } = {}) {
  const f = FONT_CSS[font];
  const attrs = {
    x,
    y,
    'font-size': size,
    'font-family': f.family,
    'text-anchor': anchor,
    class: 'ink',
    'data-layer': 'engrave',
    'data-font': font,
  };
  if (f.weight) attrs['font-weight'] = f.weight;
  if (f.style) attrs['font-style'] = f.style;
  if (ls) {
    attrs['letter-spacing'] = ls;
    // Browsers add letter-spacing after the last glyph too, which skews
    // text-anchor:middle by ls/2; nudge the preview back to true centre.
    if (anchor === 'middle') attrs.dx = ls / 2;
  }
  if (maxW) attrs['data-maxw'] = maxW;
  const t = el('text', attrs);
  t.textContent = str;
  return t;
}

/* ------------------------------------------------------------------ */
/* Pieces                                                              */
/* ------------------------------------------------------------------ */

function doorRegion(doorPoly, holes, heartPoly) {
  return (pt, clearance) => {
    if (!pointInPolygon(pt, doorPoly)) return false;
    if (distToPolygon(pt, doorPoly) < clearance) return false;
    for (const [hx, hy] of holes) {
      if (Math.hypot(pt[0] - hx, pt[1] - hy) < GEO.holeR + clearance + 1.5) return false;
    }
    if (heartPoly) {
      if (pointInPolygon(pt, heartPoly)) return false;
      if (distToPolygon(pt, heartPoly) < clearance) return false;
    }
    return true;
  };
}

function doorGroup(side, seed, withHeart, style = 'crackle') {
  const segs = side === 'left' ? leftDoorSegs() : rightDoorSegs();
  const poly = segsToPolygon(segs);
  const x0 = side === 'left' ? 0 : GEO.rightDoorX;
  const hingeX = side === 'left' ? GEO.doorW - 4 : GEO.rightDoorX + 4;
  const holes = GEO.holeYs.map((y) => [hingeX, y]);

  let heartPoly = null;
  if (withHeart) {
    heartPoly = segsToPolygon(transformSegs(heartSegs(HEART.size), heartXform));
  }

  const g = el('g', { id: side + '-door' });
  g.append(
    el('path', {
      d: segsToPath(segs),
      class: 'board',
      'data-layer': 'cut',
    })
  );

  const region = doorRegion(poly, holes, heartPoly);
  const sideSign = side === 'left' ? 1 : -1;
  if (style === 'floral') {
    g.append(...floralDoorCutouts({ side: sideSign, inside: region, seed }));
  } else if (style === 'mandala') {
    g.append(...mandalaDoorCutouts({ side: sideSign, inside: region, seed }));
  } else {
    const cutouts = generateLattice({
      bbox: [x0, 0, x0 + GEO.doorW, GEO.H],
      inside: region,
      seed: seed + (side === 'left' ? 0 : 101),
    });
    for (const d of cutouts) {
      g.append(el('path', { d, class: 'cutout', 'data-layer': 'cut' }));
    }
  }

  for (const [hx, hy] of holes) {
    g.append(
      el('circle', { cx: hx, cy: hy, r: GEO.holeR, class: 'cutout', 'data-layer': 'cut' })
    );
  }

  if (withHeart) {
    // Engraved double outline...
    for (const s of [HEART.size, HEART.size * 0.88]) {
      g.append(
        el('path', {
          d: segsToPath(transformSegs(heartSegs(s), heartXform)),
          class: 'ink-line',
          'data-layer': 'engrave-line',
        })
      );
    }
    // ...and cut flower + leaves + dots inside it.
    for (const list of heartDecorSegLists()) {
      g.append(
        el('path', {
          d: segsToPath(transformSegs(list, heartDecorXform)),
          class: 'cutout',
          'data-layer': 'cut',
        })
      );
    }
    for (const [x, y, r] of HEART_DOTS) {
      const [cx, cy] = heartDecorXform([x, y]);
      g.append(
        el('circle', {
          cx: round2(cx),
          cy: round2(cy),
          r: round2(Math.max(1, r * HEART_K)),
          class: 'cutout',
          'data-layer': 'cut',
        })
      );
    }
  }
  return g;
}

/**
 * Motif slot helper: returns the swappable graphic's nodes, or null when the
 * motif is 'none' (callers then draw their classic ornament instead).
 *
 * Full-card motifs (e.g. the grand oak) ignore the slot box; where a full
 * rendition isn't allowed (the gatefold panel), they fall back to their
 * slot-sized cousin so the dropdown always does something sensible.
 */
function motifOrNull(s, box, opts = {}) {
  const m = MOTIFS[s.motif];
  if (!m || !m.build) return null;
  if (m.full) {
    if (!opts.allowFull) {
      return MOTIFS.tree.build({ ...box, seed: s.seed });
    }
    return m.build({ cx: ARCH.cx, seed: s.seed, dy: opts.dy || 0 });
  }
  return m.build({ ...box, seed: s.seed, initials: s.initials });
}

function panelGroup(s) {
  const { panelX, panelW, H, cx } = GEO;
  const r = 4;
  const g = el('g', { id: 'panel' });

  g.append(
    el('path', {
      d:
        `M ${panelX + r} 0 L ${panelX + panelW - r} 0 Q ${panelX + panelW} 0 ${panelX + panelW} ${r} ` +
        `L ${panelX + panelW} ${H - r} Q ${panelX + panelW} ${H} ${panelX + panelW - r} ${H} ` +
        `L ${panelX + r} ${H} Q ${panelX} ${H} ${panelX} ${H - r} ` +
        `L ${panelX} ${r} Q ${panelX} 0 ${panelX + r} 0 Z`,
      class: 'board',
      'data-layer': 'cut',
    })
  );

  // Binding holes matching the doors.
  if (s.showDoors) {
    for (const y of GEO.holeYs) {
      for (const x of [panelX + 4, panelX + panelW - 4]) {
        g.append(
          el('circle', { cx: x, cy: y, r: GEO.holeR, class: 'cutout', 'data-layer': 'cut' })
        );
      }
    }
  }

  /* --- engraved content, top to bottom --- */

  const motif = motifOrNull(s, { cx, top: 7.5, h: 18 });
  if (motif) g.append(...motif);
  else g.append(...ornament(cx, 20));

  g.append(textEl(s.tagline, cx, 31, { size: 5.2, ls: 1.2, maxW: 100 }));

  // "- the -"
  g.append(el('rect', barAttrs(cx - 15.5, 39.8, 7, 0.4)));
  g.append(el('rect', barAttrs(cx + 8.5, 39.8, 7, 0.4)));
  g.append(textEl(s.lineThe, cx, 41.2, { font: 'serifItalic', size: 5.5, maxW: 40 }));

  g.append(textEl(s.title, cx, 53.5, { font: 'serifSemi', size: 11, ls: 2.2, maxW: 104 }));

  g.append(textEl(s.lineOf, cx, 62, { font: 'serifItalic', size: 5.5, maxW: 40 }));

  g.append(textEl(s.names, cx, 81, { font: 'script', size: 13.5, maxW: 106 }));

  /* --- date block --- */
  const barX = 13.5; // half-width of the centre date box
  // Vertical bars around the boxed date.
  g.append(
    el('rect', { x: cx - barX - 0.22, y: 93.5, width: 0.45, height: 25, class: 'ink', 'data-layer': 'engrave' }),
    el('rect', { x: cx + barX - 0.22, y: 93.5, width: 0.45, height: 25, class: 'ink', 'data-layer': 'engrave' })
  );
  // Rules above/below the flanking words.
  for (const y of [100.6, 111.4]) {
    g.append(el('rect', barAttrs(panelX + 10, y, cx - barX - 5 - (panelX + 10), 0.45)));
    g.append(el('rect', barAttrs(cx + barX + 5, y, panelX + panelW - 10 - (cx + barX + 5), 0.45)));
  }
  g.append(textEl(s.dayOfWeek, cx - 37, 107.7, { size: 4.8, ls: 0.7, maxW: 34 }));
  g.append(textEl(s.time, cx + 37, 107.7, { size: 4.8, ls: 0.7, maxW: 34 }));
  g.append(textEl(s.month, cx, 99.4, { size: 4.8, ls: 1, maxW: 24 }));
  g.append(textEl(s.dayNum, cx, 111.2, { font: 'serifSemi', size: 12.5, maxW: 24 }));
  g.append(textEl(s.year, cx, 117.4, { size: 4.8, ls: 1, maxW: 24 }));

  /* --- venue --- */
  g.append(textEl(s.venue, cx, 131, { size: 5.6, ls: 1, maxW: 106 }));
  s.addressLines.forEach((line, i) => {
    g.append(textEl(line, cx, 139 + i * 6.4, { size: 4.4, maxW: 106 }));
  });
  g.append(textEl(s.rsvp, cx, 156, { size: 4.4, maxW: 100 }));

  g.append(...ornament(cx, 163.5));
  g.append(textEl(s.footer, cx, 170.5, { size: 4.1, ls: 0.7, maxW: 100 }));

  return g;
}

/* ------------------------------------------------------------------ */
/* Arch die-cut template                                               */
/*                                                                     */
/* A single 5 x 7 in card with a full-arch top (the big 2026 die-cut   */
/* trend): fine double border, swappable motif in the dome, stacked    */
/* script names, oversized date row, small-caps details.               */
/* ------------------------------------------------------------------ */

const ARCH = { W: 127, H: 178, cx: 63.5, r: 63.5 };

/** Arch outline path inset by d, with small rounded bottom corners. */
function archPath(d, corner = 2.5) {
  const { W, H, r } = ARCH;
  return (
    `M ${d} ${r} ` +
    `A ${r - d} ${r - d} 0 0 1 ${W - d} ${r} ` +
    `L ${W - d} ${H - d - corner} ` +
    `Q ${W - d} ${H - d} ${W - d - corner} ${H - d} ` +
    `L ${d + corner} ${H - d} ` +
    `Q ${d} ${H - d} ${d} ${H - d - corner} Z`
  );
}

/**
 * Per-template tuning for the text layouts: dy shifts the whole stack
 * (the wave card starts higher), mw scales max text widths (the botanical
 * border eats into the sides), xL is the left margin for aligned layouts.
 */
const TUNE = {
  arch: { dy: 0, mw: 1, xL: 17 },
  botanical: { dy: 0, mw: 0.86, xL: 20 },
  wave: { dy: -6.5, mw: 0.92, xL: 17 },
};

/** Oversized centred date row: MONTH  20  YEAR with dot separators. */
function dateRow(g, s, y) {
  const { cx } = ARCH;
  g.append(textEl(s.month, cx - 26, y - 1.5, { size: 5, ls: 1.2, maxW: 26 }));
  g.append(textEl(s.dayNum, cx, y, { font: 'serifSemi', size: 13.5, maxW: 20 }));
  g.append(textEl(s.year, cx + 26, y - 1.5, { size: 5, ls: 1.2, maxW: 26 }));
  for (const dx of [-13.5, 13.5]) {
    g.append(
      el('circle', { cx: cx + dx, cy: y - 3.5, r: 0.7, class: 'ink', 'data-layer': 'engrave' })
    );
  }
}

/** Centred venue / address / RSVP / footer block. */
function detailsCentered(g, s, mw, ys) {
  const { cx } = ARCH;
  g.append(textEl(s.venue, cx, ys.venue, { size: 5.4, ls: 1, maxW: 104 * mw }));
  s.addressLines.forEach((line, i) => {
    g.append(textEl(line, cx, ys.addr + i * 5.6, { size: 4.4, maxW: 104 * mw }));
  });
  g.append(textEl(s.rsvp, cx, ys.rsvp, { size: 4.4, maxW: 98 * mw }));
  g.append(textEl(s.footer, cx, ys.foot, { size: 4, ls: 0.7, maxW: 98 * mw }));
}

function joinParts(parts, sep) {
  return parts.filter(Boolean).join(sep);
}

/**
 * Text layouts for the card templates. Each is a distinct arrangement so
 * the same template can produce visibly different invitations.
 */
const LAYOUTS = {
  /** Stacked script names over an oversized boxed-free date row. */
  classic(g, s, t) {
    const { cx } = ARCH;
    const d = t.dy;
    const mw = t.mw;
    g.append(textEl(s.tagline, cx, 63 + d, { size: 4.6, ls: 1.1, maxW: 96 * mw }));
    g.append(textEl(s.name1, cx, 80 + d, { font: 'script', size: 12.5, maxW: 100 * mw }));
    g.append(textEl('&', cx, 89.5 + d, { font: 'serifItalic', size: 6, maxW: 20 }));
    g.append(textEl(s.name2, cx, 102.5 + d, { font: 'script', size: 12.5, maxW: 100 * mw }));
    dateRow(g, s, 123 + d);
    const dowTime = joinParts([s.dayOfWeek, s.time], '  ·  ');
    g.append(textEl(dowTime, cx, 131.5 + d, { size: 4.4, ls: 0.8, maxW: 100 * mw }));
    g.append(el('rect', barAttrs(cx - 7, 138.5 + d, 14, 0.4)));
    detailsCentered(g, s, mw, {
      venue: 145.5 + d, addr: 152 + d, rsvp: 163.5 + d, foot: 169.8 + d,
    });
  },

  /** Left-aligned editorial style with generous whitespace. */
  modern(g, s, t) {
    const d = t.dy;
    const x = t.xL;
    const maxW = 127 - x - (t.mw < 1 ? 17 : 12);
    const L = { anchor: 'start' };
    g.append(textEl(s.tagline, x, 62 + d, { ...L, size: 4.4, ls: 1.2, maxW }));
    g.append(textEl(s.name1, x, 81 + d, { ...L, font: 'script', size: 13.5, maxW }));
    g.append(textEl('& ' + s.name2, x, 99 + d, { ...L, font: 'script', size: 13.5, maxW }));
    g.append(el('rect', barAttrs(x, 108 + d, 22, 0.5)));
    const dateLine = joinParts(
      [s.dayOfWeek, joinParts([joinParts([s.month, s.dayNum], ' '), s.year], ', ')],
      ', '
    );
    g.append(textEl(dateLine, x, 117 + d, { ...L, size: 4.8, ls: 0.8, maxW }));
    g.append(textEl(s.time, x, 124 + d, { ...L, size: 4.4, ls: 0.8, maxW }));
    g.append(textEl(s.venue, x, 137 + d, { ...L, size: 5.2, ls: 1, maxW }));
    s.addressLines.forEach((line, i) => {
      g.append(textEl(line, x, 143.5 + d + i * 5.6, { ...L, size: 4.4, maxW }));
    });
    g.append(textEl(s.rsvp, x, 156.5 + d, { ...L, size: 4.4, maxW }));
    g.append(textEl(s.footer, x, 168.5 + d, { ...L, size: 3.9, ls: 0.8, maxW }));
  },

  /** Names in large letterspaced serif caps - high-fashion editorial. */
  editorial(g, s, t) {
    const { cx } = ARCH;
    const d = t.dy;
    const mw = t.mw;
    g.append(textEl(s.tagline, cx, 63 + d, { size: 4.4, ls: 1, maxW: 96 * mw }));
    g.append(
      textEl(s.name1.toUpperCase(), cx, 79 + d, { size: 8, ls: 2, maxW: 100 * mw })
    );
    g.append(textEl('&', cx, 90.5 + d, { font: 'script', size: 9.5, maxW: 20 }));
    g.append(
      textEl(s.name2.toUpperCase(), cx, 102 + d, { size: 8, ls: 2, maxW: 100 * mw })
    );
    dateRow(g, s, 123 + d);
    const dowTime = joinParts([s.dayOfWeek, s.time], '  ·  ');
    g.append(textEl(dowTime, cx, 131.5 + d, { size: 4.4, ls: 0.8, maxW: 100 * mw }));
    g.append(el('rect', barAttrs(cx - 7, 138.5 + d, 14, 0.4)));
    detailsCentered(g, s, mw, {
      venue: 145.5 + d, addr: 152 + d, rsvp: 163.5 + d, foot: 169.8 + d,
    });
  },

  /** Giant script monogram up top (replaces the graphic), names on one line. */
  crest(g, s, t) {
    const { cx } = ARCH;
    const d = t.dy;
    const mw = t.mw;
    g.append(textEl(s.initials, cx, 46 + d, { font: 'script', size: 16, maxW: 64 }));
    g.append(...ornament(cx, 54 + d));
    g.append(textEl(s.tagline, cx, 64 + d, { size: 4.4, ls: 1, maxW: 96 * mw }));
    g.append(textEl(s.names, cx, 82 + d, { font: 'script', size: 10.5, maxW: 104 * mw }));
    dateRow(g, s, 105 + d);
    const dowTime = joinParts([s.dayOfWeek, s.time], '  ·  ');
    g.append(textEl(dowTime, cx, 113.5 + d, { size: 4.4, ls: 0.8, maxW: 100 * mw }));
    g.append(el('rect', barAttrs(cx - 7, 120.5 + d, 14, 0.4)));
    detailsCentered(g, s, mw, {
      venue: 133 + d, addr: 139.5 + d, rsvp: 155.5 + d, foot: 165 + d,
    });
  },
};

function renderLayout(g, s, t) {
  (LAYOUTS[s.layout] || LAYOUTS.classic)(g, s, t);
}

function archGroup(s) {
  const { cx } = ARCH;
  const g = el('g', { id: 'arch-card' });

  g.append(el('path', { d: archPath(0), class: 'board', 'data-layer': 'cut' }));

  // Fine double border echoing the die-cut edge.
  for (const d of [4, 5.6]) {
    g.append(
      el('path', { d: archPath(d), class: 'ink-line', 'data-layer': 'engrave-line' })
    );
  }

  // Swappable graphic inside the dome (the crest layout brings its own).
  if (s.layout !== 'crest') {
    const motif = motifOrNull(s, { cx, top: 20, h: 34 }, { allowFull: true, dy: TUNE.arch.dy });
    if (motif) g.append(...motif);
    else g.append(...ornament(cx, 40));
  }

  renderLayout(g, s, TUNE.arch);
  return g;
}

/** Arch card wrapped in a generative engraved botanical border. */
function botanicalGroup(s) {
  const { cx } = ARCH;
  const g = el('g', { id: 'botanical-card' });

  g.append(el('path', { d: archPath(0), class: 'board', 'data-layer': 'cut' }));
  g.append(el('path', { d: archPath(4), class: 'ink-line', 'data-layer': 'engrave-line' }));

  g.append(...buildBorderVine({ seed: s.seed }));

  if (s.layout !== 'crest') {
    const motif = motifOrNull(s, { cx, top: 22, h: 30 }, { allowFull: true, dy: TUNE.botanical.dy });
    if (motif) g.append(...motif);
  }

  renderLayout(g, s, TUNE.botanical);
  return g;
}

/* ------------------------------------------------------------------ */
/* Wavy-edge template                                                  */
/* ------------------------------------------------------------------ */

/**
 * Rectangle with a sinusoidal die-cut edge; the wave fades out near the
 * rounded corners so the outline stays smooth and snag-free.
 */
function wavyRectPath(inset, amp, wl = 15) {
  const { W, H } = ARCH;
  const c = 8; // corner radius
  const xL = inset;
  const xR = W - inset;
  const yT = inset;
  const yB = H - inset;
  const pts = [];

  const edge = (from, to, normal) => {
    const len = Math.hypot(to[0] - from[0], to[1] - from[1]);
    for (let d = 0; d <= len; d += 1.2) {
      const taper = Math.min(1, d / 14, (len - d) / 14);
      const w = amp * Math.sin((d / wl) * 2 * Math.PI) * taper;
      const t = d / len;
      pts.push([
        from[0] + (to[0] - from[0]) * t + normal[0] * w,
        from[1] + (to[1] - from[1]) * t + normal[1] * w,
      ]);
    }
  };
  const cornerArc = (centre, a0) => {
    for (let i = 0; i <= 8; i++) {
      const a = a0 + (i / 8) * (Math.PI / 2);
      pts.push([centre[0] + c * Math.cos(a), centre[1] + c * Math.sin(a)]);
    }
  };

  edge([xL + c, yT], [xR - c, yT], [0, -1]);
  cornerArc([xR - c, yT + c], -Math.PI / 2);
  edge([xR, yT + c], [xR, yB - c], [1, 0]);
  cornerArc([xR - c, yB - c], 0);
  edge([xR - c, yB], [xL + c, yB], [0, 1]);
  cornerArc([xL + c, yB - c], Math.PI / 2);
  edge([xL, yB - c], [xL, yT + c], [-1, 0]);
  cornerArc([xL + c, yT + c], Math.PI);

  return 'M ' + pts.map(fmtP).join(' L ') + ' Z';
}

function waveGroup(s) {
  const { W, H, cx } = ARCH;
  const g = el('g', { id: 'wave-card' });

  // Seed the wavelength so every shuffled card has its own edge.
  const wl = 13.5 + mulberry32((s.seed + 9) >>> 0)() * 3.5;
  g.append(el('path', { d: wavyRectPath(0, 1.8, wl), class: 'board', 'data-layer': 'cut' }));
  g.append(
    el('path', { d: wavyRectPath(4.2, 1.2, wl), class: 'ink-line', 'data-layer': 'engrave-line' })
  );

  // Botanical sprays in all four corners, each grown from the seed.
  [
    [[0, 0], [1, 1]],
    [[W, 0], [-1, 1]],
    [[0, H], [1, -1]],
    [[W, H], [-1, -1]],
  ].forEach(([corner, dir], i) => {
    g.append(...buildCornerSpray({ corner, dir, seed: s.seed + i * 17 }));
  });

  if (s.layout !== 'crest') {
    const motif = motifOrNull(s, { cx, top: 14, h: 32 }, { allowFull: true, dy: TUNE.wave.dy });
    if (motif) g.append(...motif);
    else g.append(...ornament(cx, 30));
  }

  renderLayout(g, s, TUNE.wave);
  return g;
}

/* ------------------------------------------------------------------ */
/* Whole document                                                      */
/* ------------------------------------------------------------------ */

const CARD_TEMPLATES = {
  arch: archGroup,
  botanical: botanicalGroup,
  wave: waveGroup,
};

function buildInvitationSVG(strings, opts) {
  const m = GEO.margin;
  const s = { ...strings, motif: opts.motif, seed: opts.seed };

  s.layout = opts.layout || 'classic';
  const cardBuilder = CARD_TEMPLATES[opts.template];
  if (cardBuilder) {
    const svg = el('svg', {
      xmlns: NS,
      viewBox: `${-m} ${-m} ${ARCH.W + 2 * m} ${ARCH.H + 2 * m}`,
      width: ARCH.W + 2 * m + 'mm',
      height: ARCH.H + 2 * m + 'mm',
    });
    svg.append(cardBuilder(s));
    return svg;
  }

  // Gatefold template.
  const x0 = opts.showDoors ? -m : GEO.panelX - m;
  const w = opts.showDoors ? GEO.totalW + 2 * m : GEO.panelW + 2 * m;
  const h = GEO.H + 2 * m;

  const svg = el('svg', {
    xmlns: NS,
    viewBox: `${x0} ${-m} ${w} ${h}`,
    width: w + 'mm',
    height: h + 'mm',
  });

  // The mandala fan radiates from the notch apex where the heart would sit,
  // so the heart only applies to the other door styles.
  const heart = opts.showHeart && opts.doorStyle !== 'mandala';
  if (opts.showDoors) {
    svg.append(doorGroup('left', opts.seed, false, opts.doorStyle));
    svg.append(doorGroup('right', opts.seed, heart, opts.doorStyle));
  }
  svg.append(panelGroup({ ...s, showDoors: opts.showDoors }));
  return svg;
}
