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

function textEl(str, x, y, { font = 'serif', size = 5, ls = 0, maxW } = {}) {
  const f = FONT_CSS[font];
  const attrs = {
    x,
    y,
    'font-size': size,
    'font-family': f.family,
    'text-anchor': 'middle',
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
    attrs.dx = ls / 2;
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
    g.append(...mandalaDoorCutouts({ side: sideSign, inside: region }));
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
 */
function motifOrNull(s, box) {
  if (!s.motif || s.motif === 'none') return null;
  return motifNodes(s.motif, { ...box, seed: s.seed, initials: s.initials });
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

/** Per-template vertical layout for the shared centre text stack. */
const STACKS = {
  arch: {
    tag: 63, n1: 80, amp: 89.5, n2: 102.5, dSm: 121.5, dBig: 123, dots: 119.5,
    dow: 131.5, div: 138.5, venue: 145.5, addr: 152, rsvp: 163.5, foot: 169.8, mw: 1,
  },
  botanical: {
    tag: 63, n1: 80, amp: 89.5, n2: 102.5, dSm: 121.5, dBig: 123, dots: 119.5,
    dow: 131.5, div: 138.5, venue: 145.5, addr: 152, rsvp: 163.5, foot: 169.8, mw: 0.86,
  },
  wave: {
    tag: 57, n1: 74, amp: 83.5, n2: 96.5, dSm: 114.5, dBig: 116, dots: 112.5,
    dow: 124.5, div: 131, venue: 138.5, addr: 145, rsvp: 156.5, foot: 163, mw: 0.92,
  },
};

/** Tagline / names / oversized date / venue block shared by card templates. */
function centerStack(g, s, L) {
  const { cx } = ARCH;
  const mw = L.mw;

  g.append(textEl(s.tagline, cx, L.tag, { size: 4.6, ls: 1.1, maxW: 96 * mw }));

  // Stacked script names - mixed typography trend.
  g.append(textEl(s.name1, cx, L.n1, { font: 'script', size: 12.5, maxW: 100 * mw }));
  g.append(textEl('&', cx, L.amp, { font: 'serifItalic', size: 6, maxW: 20 }));
  g.append(textEl(s.name2, cx, L.n2, { font: 'script', size: 12.5, maxW: 100 * mw }));

  // Oversized date row: MONTH  20  YEAR with dot separators.
  g.append(textEl(s.month, cx - 26, L.dSm, { size: 5, ls: 1.2, maxW: 26 }));
  g.append(textEl(s.dayNum, cx, L.dBig, { font: 'serifSemi', size: 13.5, maxW: 20 }));
  g.append(textEl(s.year, cx + 26, L.dSm, { size: 5, ls: 1.2, maxW: 26 }));
  for (const dx of [-13.5, 13.5]) {
    g.append(
      el('circle', { cx: cx + dx, cy: L.dots, r: 0.7, class: 'ink', 'data-layer': 'engrave' })
    );
  }

  const dowTime = [s.dayOfWeek, s.time].filter(Boolean).join('  ·  ');
  g.append(textEl(dowTime, cx, L.dow, { size: 4.4, ls: 0.8, maxW: 100 * mw }));

  g.append(el('rect', barAttrs(cx - 7, L.div, 14, 0.4)));

  g.append(textEl(s.venue, cx, L.venue, { size: 5.4, ls: 1, maxW: 104 * mw }));
  s.addressLines.forEach((line, i) => {
    g.append(textEl(line, cx, L.addr + i * 5.6, { size: 4.4, maxW: 104 * mw }));
  });
  g.append(textEl(s.rsvp, cx, L.rsvp, { size: 4.4, maxW: 98 * mw }));
  g.append(textEl(s.footer, cx, L.foot, { size: 4, ls: 0.7, maxW: 98 * mw }));
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

  // Swappable graphic inside the dome.
  const motif = motifOrNull(s, { cx, top: 20, h: 34 });
  if (motif) g.append(...motif);
  else g.append(...ornament(cx, 40));

  centerStack(g, s, STACKS.arch);
  return g;
}

/** Arch card wrapped in a generative engraved botanical border. */
function botanicalGroup(s) {
  const { cx } = ARCH;
  const g = el('g', { id: 'botanical-card' });

  g.append(el('path', { d: archPath(0), class: 'board', 'data-layer': 'cut' }));
  g.append(el('path', { d: archPath(4), class: 'ink-line', 'data-layer': 'engrave-line' }));

  g.append(...buildBorderVine({ seed: s.seed }));

  const motif = motifOrNull(s, { cx, top: 22, h: 30 });
  if (motif) g.append(...motif);

  centerStack(g, s, STACKS.botanical);
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

  g.append(el('path', { d: wavyRectPath(0, 1.8), class: 'board', 'data-layer': 'cut' }));
  g.append(
    el('path', { d: wavyRectPath(4.2, 1.2), class: 'ink-line', 'data-layer': 'engrave-line' })
  );

  // Botanical sprays in all four corners.
  for (const [corner, dir] of [
    [[0, 0], [1, 1]],
    [[W, 0], [-1, 1]],
    [[0, H], [1, -1]],
    [[W, H], [-1, -1]],
  ]) {
    g.append(...buildCornerSpray({ corner, dir }));
  }

  const motif = motifOrNull(s, { cx, top: 14, h: 32 });
  if (motif) g.append(...motif);
  else g.append(...ornament(cx, 30));

  centerStack(g, s, STACKS.wave);
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
