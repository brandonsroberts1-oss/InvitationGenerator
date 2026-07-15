/*
 * Swappable engraved graphics ("motifs").
 *
 * Each motif is drawn in a local 100x100 box (y down, bottom = 100) and
 * mapped into world millimetres from {cx, top, h}. Everything is emitted as
 * plain engrave layers - filled shapes (data-layer="engrave") and fine
 * strokes (data-layer="engrave-line") - so exports need no special handling.
 */

'use strict';

function motifMapper(cx, top, h) {
  const k = h / 100;
  return ([u, v]) => [cx + (u - 50) * k, top + v * k];
}

function fmtP(p) {
  return round2(p[0]) + ' ' + round2(p[1]);
}

function inkPath(d) {
  return el('path', { d, class: 'ink', 'data-layer': 'engrave' });
}

function linePath(d) {
  return el('path', { d, class: 'ink-line', 'data-layer': 'engrave-line' });
}

function inkDot([x, y], r) {
  return el('circle', {
    cx: round2(x),
    cy: round2(y),
    r: round2(r),
    class: 'ink',
    'data-layer': 'engrave',
  });
}

/* ------------------------------------------------------------------ */
/* Old romantic tree - generative branching oak                        */
/* ------------------------------------------------------------------ */

function buildTree({ cx, top, h, seed = 1 }) {
  const k = h / 100;
  const P = motifMapper(cx, top, h);
  const rng = mulberry32(((seed * 2654435761) >>> 0) || 42);
  const nodes = [];
  const leaves = [];

  function branch(x, y, ang, len, w, depth) {
    const ex = x + Math.cos(ang) * len;
    const ey = y + Math.sin(ang) * len;
    const we = Math.max(w * 0.62, 0.8);
    const px = -Math.sin(ang);
    const py = Math.cos(ang);
    const bend = (rng() - 0.5) * len * 0.35;
    const mx = (x + ex) / 2 + px * bend;
    const my = (y + ey) / 2 + py * bend;

    // Tapered, gently curved branch as a closed filled shape.
    const cw = (w + we) / 4;
    const d =
      `M ${fmtP(P([x + (px * w) / 2, y + (py * w) / 2]))} ` +
      `Q ${fmtP(P([mx + px * cw, my + py * cw]))} ${fmtP(P([ex + (px * we) / 2, ey + (py * we) / 2]))} ` +
      `L ${fmtP(P([ex - (px * we) / 2, ey - (py * we) / 2]))} ` +
      `Q ${fmtP(P([mx - px * cw, my - py * cw]))} ${fmtP(P([x - (px * w) / 2, y - (py * w) / 2]))} Z`;
    nodes.push(inkPath(d));

    if (depth >= 4 || w * 0.55 < 1.1) {
      // Blossom cluster at the twig tip.
      const n = 3 + Math.floor(rng() * 3);
      for (let i = 0; i < n; i++) {
        const la = rng() * Math.PI * 2;
        const lr = rng() * 4.5;
        leaves.push([ex + Math.cos(la) * lr, ey + Math.sin(la) * lr, 1.2 + rng() * 1.4]);
      }
      return;
    }

    if (depth === 0) {
      // First fork: fan out symmetrically around vertical so the canopy
      // stays balanced no matter what the seed does further up.
      for (const base of [-0.85, -0.3, 0.3, 0.85]) {
        branch(
          ex, ey,
          -Math.PI / 2 + base + (rng() - 0.5) * 0.15,
          len * (0.68 + rng() * 0.1),
          w * 0.55,
          1
        );
      }
      return;
    }

    const outAng = Math.atan2(ey - my, ex - mx);
    const nC = depth === 1 ? 3 : rng() < 0.5 ? 3 : 2;
    for (let i = 0; i < nC; i++) {
      const spread = (i - (nC - 1) / 2) * (0.42 + rng() * 0.18) + (rng() - 0.5) * 0.18;
      branch(ex, ey, outAng + spread, len * (0.62 + rng() * 0.12), w * 0.55, depth + 1);
    }
  }

  branch(50, 96, -Math.PI / 2 + (rng() - 0.5) * 0.08, 30, 8.5, 0);

  for (const [lx, ly, lr] of leaves) {
    nodes.push(inkDot(P([lx, ly]), Math.max(0.35, lr * k)));
  }

  // Ground swell under the trunk.
  nodes.push(
    linePath(`M ${fmtP(P([16, 96.5]))} Q ${fmtP(P([50, 101]))} ${fmtP(P([84, 96.5]))}`)
  );
  return nodes;
}

/* ------------------------------------------------------------------ */
/* Laurel wreath with the couple's initials                            */
/* ------------------------------------------------------------------ */

function buildWreath({ cx, top, h, initials = '' }) {
  const k = h / 100;
  const nodes = [];
  const C = [50, 51];
  const R = 35;

  const world = (side) => (p) => {
    const q = side === 1 ? p : [100 - p[0], p[1]];
    return [cx + (q[0] - 50) * k, top + q[1] * k];
  };

  for (const side of [1, -1]) {
    const W = world(side);

    // Stem: an arc rising from the bottom to near the top, open at the top.
    let d = '';
    for (let a = 88; a <= 232; a += 6) {
      const t = (a * Math.PI) / 180;
      d +=
        (d ? ' L ' : 'M ') +
        fmtP(W([C[0] + R * Math.cos(t), C[1] + R * Math.sin(t)]));
    }
    nodes.push(linePath(d));

    // Leaves alternating along the stem, plus the odd berry.
    let i = 0;
    for (let a = 100; a <= 226; a += 14, i++) {
      const t = (a * Math.PI) / 180;
      const base = [C[0] + R * Math.cos(t), C[1] + R * Math.sin(t)];
      const ang = t + Math.PI / 2 + (i % 2 ? 0.62 : -0.62);
      const place = rotateAbout(base, ang);
      nodes.push(
        inkPath(segsToPath(transformSegs(petalSegs(8.5, 2.4), (p) => W(place(p)))))
      );
      if (i % 3 === 1) {
        const off = i % 2 ? 5.5 : -5.5;
        nodes.push(
          inkDot(
            W([C[0] + (R + off) * Math.cos(t + 0.09), C[1] + (R + off) * Math.sin(t + 0.09)]),
            Math.max(0.4, 1.2 * k)
          )
        );
      }
    }
  }

  if (initials) {
    nodes.push(
      textEl(initials, cx, top + 58 * k, { font: 'script', size: 23 * k, maxW: 48 * k })
    );
  }
  return nodes;
}

/* ------------------------------------------------------------------ */
/* Tiered wedding cake                                                 */
/* ------------------------------------------------------------------ */

function buildCake({ cx, top, h }) {
  const k = h / 100;
  const P = motifMapper(cx, top, h);
  const nodes = [];

  const rect = (u, v, w, ht) =>
    el('rect', {
      x: round2(cx + (u - 50) * k),
      y: round2(top + v * k),
      width: round2(w * k),
      height: round2(ht * k),
      rx: round2(2 * k),
      class: 'ink-line',
      'data-layer': 'engrave-line',
    });

  // Three tiers.
  nodes.push(rect(20, 66, 60, 20), rect(27, 49, 46, 17), rect(34, 33.5, 32, 15.5));

  // Scalloped icing under each tier's top edge.
  for (const [x0, x1, y] of [
    [23, 77, 66],
    [30, 70, 49],
    [36.5, 63.5, 33.5],
  ]) {
    let d = `M ${fmtP(P([x0, y]))}`;
    const n = Math.round((x1 - x0) / 6);
    const step = (x1 - x0) / n;
    for (let i = 0; i < n; i++) {
      d += ` Q ${fmtP(P([x0 + step * (i + 0.5), y + 4.6]))} ${fmtP(P([x0 + step * (i + 1), y]))}`;
    }
    nodes.push(linePath(d));
  }

  // Dot piping on the bottom tier.
  for (let u = 26; u <= 74; u += 6) {
    nodes.push(inkDot(P([u, 80]), Math.max(0.35, 1 * k)));
  }

  // Cake stand: plate, stem, foot.
  nodes.push(linePath(`M ${fmtP(P([15, 87.5]))} L ${fmtP(P([85, 87.5]))}`));
  nodes.push(
    inkPath(
      `M ${fmtP(P([46, 89]))} L ${fmtP(P([42.5, 95]))} L ${fmtP(P([57.5, 95]))} L ${fmtP(P([54, 89]))} Z`
    )
  );
  nodes.push(
    inkPath(
      `M ${fmtP(P([36, 95.5]))} L ${fmtP(P([64, 95.5]))} L ${fmtP(P([64, 97.5]))} L ${fmtP(P([36, 97.5]))} Z`
    )
  );

  // Heart topper with two dots.
  nodes.push(
    inkPath(segsToPath(transformSegs(heartSegs(7), (p) => P([50 + p[0], 26 + p[1]]))))
  );
  nodes.push(inkDot(P([41, 29]), Math.max(0.4, 1.1 * k)));
  nodes.push(inkDot(P([59, 29]), Math.max(0.4, 1.1 * k)));
  return nodes;
}

/* ------------------------------------------------------------------ */
/* Mountain range                                                      */
/* ------------------------------------------------------------------ */

function buildMountains({ cx, top, h }) {
  const k = h / 100;
  const P = motifMapper(cx, top, h);
  const nodes = [];

  // Baseline.
  nodes.push(linePath(`M ${fmtP(P([12, 80]))} L ${fmtP(P([88, 80]))}`));

  // Two overlapping peaks.
  nodes.push(
    linePath(`M ${fmtP(P([16, 80]))} L ${fmtP(P([45, 32]))} L ${fmtP(P([74, 80]))}`)
  );
  nodes.push(
    linePath(`M ${fmtP(P([50, 80]))} L ${fmtP(P([72, 46]))} L ${fmtP(P([90, 80]))}`)
  );

  // Snow lines.
  nodes.push(
    linePath(
      `M ${fmtP(P([39, 42]))} L ${fmtP(P([43, 46]))} L ${fmtP(P([46, 42]))} ` +
        `L ${fmtP(P([49, 46]))} L ${fmtP(P([52, 42]))}`
    )
  );
  nodes.push(
    linePath(`M ${fmtP(P([67, 54]))} L ${fmtP(P([70, 57]))} L ${fmtP(P([73, 54]))}`)
  );

  // Sun and birds.
  nodes.push(
    el('circle', {
      cx: round2(cx + (27 - 50) * k),
      cy: round2(top + 34 * k),
      r: round2(7.5 * k),
      class: 'ink-line',
      'data-layer': 'engrave-line',
    })
  );
  for (const [bx, by, s] of [
    [60, 24, 1],
    [69, 19, 0.75],
  ]) {
    nodes.push(
      linePath(
        `M ${fmtP(P([bx - 4 * s, by]))} Q ${fmtP(P([bx - 2 * s, by - 3 * s]))} ${fmtP(P([bx, by]))} ` +
          `Q ${fmtP(P([bx + 2 * s, by - 3 * s]))} ${fmtP(P([bx + 4 * s, by]))}`
      )
    );
  }

  // Little pines at the foothills.
  for (const [px, ph] of [
    [21, 10],
    [28, 7.5],
    [82, 9],
  ]) {
    nodes.push(
      inkPath(
        `M ${fmtP(P([px - 3.2, 80]))} L ${fmtP(P([px, 80 - ph]))} L ${fmtP(P([px + 3.2, 80]))} Z`
      )
    );
  }
  return nodes;
}

/* ------------------------------------------------------------------ */
/* Interlocked wedding rings                                           */
/* ------------------------------------------------------------------ */

function buildRings({ cx, top, h }) {
  const k = h / 100;
  const P = motifMapper(cx, top, h);
  const nodes = [];

  for (const [u, v] of [
    [42, 56],
    [60, 50],
  ]) {
    const c = P([u, v]);
    nodes.push(
      el('circle', {
        cx: round2(c[0]),
        cy: round2(c[1]),
        r: round2(16 * k),
        class: 'ink-line',
        'data-layer': 'engrave-line',
      })
    );
  }

  // Gem sitting on the second band, with sparkles.
  nodes.push(
    inkPath(
      `M ${fmtP(P([60, 27.5]))} L ${fmtP(P([63.5, 32]))} L ${fmtP(P([60, 36.5]))} ` +
        `L ${fmtP(P([56.5, 32]))} Z`
    )
  );
  for (const [sx, sy, s] of [
    [73, 24, 1],
    [30, 32, 0.7],
  ]) {
    nodes.push(linePath(`M ${fmtP(P([sx, sy - 3.5 * s]))} L ${fmtP(P([sx, sy + 3.5 * s]))}`));
    nodes.push(linePath(`M ${fmtP(P([sx - 3.5 * s, sy]))} L ${fmtP(P([sx + 3.5 * s, sy]))}`));
  }
  return nodes;
}

/* ------------------------------------------------------------------ */

const MOTIFS = {
  none: { label: 'None (classic ornament)', build: null },
  tree: { label: 'Old romantic tree', build: buildTree },
  wreath: { label: 'Laurel wreath & initials', build: buildWreath },
  cake: { label: 'Wedding cake', build: buildCake },
  mountains: { label: 'Mountain range', build: buildMountains },
  rings: { label: 'Wedding rings', build: buildRings },
};

function motifNodes(id, box) {
  const m = MOTIFS[id];
  return m && m.build ? m.build(box) : null;
}
