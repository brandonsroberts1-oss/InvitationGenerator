/*
 * Alternative lace styles for the gatefold doors.
 *
 * Every generator works in local door coordinates ([0..62] x [0..178]) and
 * maps points into world millimetres, mirrored for the right door. All
 * cutouts are hit-tested against the door region (edges, notch, binding
 * holes, heart) with a safety clearance, so patterns clip cleanly no matter
 * what they overlap.
 */

'use strict';

const DOOR_W = 62;

/** Local door coords -> world, mirrored for the right door. */
function doorMapper(side) {
  const x0 = side === 1 ? 0 : GEO.rightDoorX;
  return (p) => [x0 + (side === 1 ? p[0] : DOOR_W - p[0]), p[1]];
}

function cutPathNode(d) {
  return el('path', { d, class: 'cutout', 'data-layer': 'cut' });
}

function cutDotNode([x, y], r) {
  return el('circle', {
    cx: round2(x),
    cy: round2(y),
    r: round2(r),
    class: 'cutout',
    'data-layer': 'cut',
  });
}

/** Leaf/petal cutout anchored at `base` pointing along `ang`; null if unsafe. */
function petalCutAt(map, inside, base, ang, len, wid) {
  const place = rotateAbout(base, ang);
  if (!inside(map(base), 2.5) || !inside(map(place([len, 0])), 2.5)) return null;
  return cutPathNode(segsToPath(transformSegs(petalSegs(len, wid), (p) => map(place(p)))));
}

/* ------------------------------------------------------------------ */
/* Floral vines: engraved winding stems with leaf + flower cutouts     */
/* ------------------------------------------------------------------ */

function floralDoorCutouts({ side, inside, seed }) {
  const map = doorMapper(side);
  const rng = mulberry32((seed + (side === 1 ? 11 : 73)) >>> 0);
  const nodes = [];

  for (const [vx, phase] of [
    [20, 0],
    [42, 28],
  ]) {
    const pts = [];
    for (let y = 10; y <= 168; y += 2) {
      pts.push([vx + 7 * Math.sin(((y + phase) / 58) * 2 * Math.PI), y]);
    }

    // Engraved stem, broken wherever it would cross the notch/holes/heart.
    let run = [];
    const flush = () => {
      if (run.length > 4) {
        nodes.push(
          el('path', {
            d: 'M ' + run.map(fmtP).join(' L '),
            class: 'ink-line',
            'data-layer': 'engrave-line',
          })
        );
      }
      run = [];
    };
    for (const p of pts) {
      const w = map(p);
      if (inside(w, 3.5)) run.push(w);
      else flush();
    }
    flush();

    // Leaf cutouts along the stem, alternating sides; occasional berries.
    let dist = 0;
    let next = 6;
    let flip = 1;
    let count = 0;
    for (let i = 1; i < pts.length; i++) {
      const dx = pts[i][0] - pts[i - 1][0];
      dist += Math.hypot(dx, 2);
      if (dist < next) continue;
      next += 8.5;
      flip = -flip;
      count++;
      const theta = Math.atan2(2, dx);
      const leaf = petalCutAt(map, inside, pts[i], theta + flip * 0.95, 6 + rng() * 1.5, 2.3);
      if (leaf) nodes.push(leaf);
      if (count % 4 === 0) {
        const b = [pts[i][0] - Math.sin(theta) * 3.5 * flip, pts[i][1] + Math.cos(theta) * 3.5 * flip];
        if (inside(map(b), 3.4)) nodes.push(cutDotNode(map(b), 1.25));
      }
    }
  }

  // Six-petal flowers between the vines.
  const fys = side === 1 ? [32, 89, 146] : [38, 95, 152];
  fys.forEach((fy, i) => {
    const c = [31, fy];
    if (!inside(map(c), 10)) return;
    nodes.push(cutDotNode(map(c), 1.4));
    for (let k = 0; k < 6; k++) {
      const A = (k * Math.PI) / 3 + i * 0.4;
      const base = [c[0] + 2.7 * Math.cos(A), c[1] + 2.7 * Math.sin(A)];
      const petal = petalCutAt(map, inside, base, A, 4.6, 2);
      if (petal) nodes.push(petal);
    }
  });

  return nodes;
}

/* ------------------------------------------------------------------ */
/* Mandala fan: radial lace bursting from the notch apex               */
/* ------------------------------------------------------------------ */

function mandalaDoorCutouts({ side, inside }) {
  const map = doorMapper(side);
  const nodes = [];

  const fan = (c, a0, a1, rings) => {
    for (const ring of rings) {
      for (let i = 0; i < ring.n; i++) {
        const A = ((a0 + ((a1 - a0) * i) / (ring.n - 1)) * Math.PI) / 180;
        const base = [c[0] + ring.r * Math.cos(A), c[1] + ring.r * Math.sin(A)];
        if (ring.type === 'petal') {
          const petal = petalCutAt(map, inside, base, A, ring.len, ring.wid);
          if (petal) nodes.push(petal);
        } else {
          const w = map(base);
          if (inside(w, 2.2 + ring.dr)) nodes.push(cutDotNode(w, ring.dr));
        }
      }
    }
  };

  // Big half-mandala centred on the notch apex, opening into the door.
  fan([17, 89], -72, 72, [
    { type: 'petal', r: 9, n: 7, len: 6.5, wid: 2.4 },
    { type: 'dot', r: 17, n: 9, dr: 1.1 },
    { type: 'petal', r: 20.5, n: 9, len: 8.5, wid: 3 },
    { type: 'dot', r: 31, n: 11, dr: 1.2 },
    { type: 'petal', r: 34, n: 9, len: 10, wid: 3.4 },
    { type: 'dot', r: 46.5, n: 13, dr: 1.1 },
  ]);

  // Small quarter-fans in the outer corners.
  const corner = [
    { type: 'petal', r: 7.5, n: 4, len: 5.5, wid: 2 },
    { type: 'dot', r: 13.5, n: 5, dr: 1 },
    { type: 'petal', r: 16.5, n: 5, len: 7, wid: 2.4 },
  ];
  fan([7, 7], 10, 80, corner);
  fan([7, 171], -10, -80, corner);

  return nodes;
}
